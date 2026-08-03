/**
 * @license
 * Copyright 2026 The zb Authors
 * SPDX-License-Identifier: MIT
 */

import crypto from 'node:crypto';
import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import process from 'node:process';
import path from 'node:path';

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { downloadTool, extractTar, extractZip } from '@actions/tool-cache';

import { serveLogFilePathKey, servePIDKey } from './shared';

interface Release {
  tagName: string;
  releaseAssets: ReleaseAssetConnection;
}

interface ReleaseAssetConnection {
  nodes: ReleaseAsset[];
}

interface ReleaseAsset {
  name: string;
  downloadUrl: string;
}

const releaseFragment =
  `
    fragment releaseFields on Release {
      tagName
      releaseAssets(first: 50) {
        nodes {
          name
          downloadUrl
        }
      }
    }
  `;

function extractArchive(file: string, name?: string): Promise<string> {
  if ((name || file).endsWith('.zip')) {
    return extractZip(file);
  } else if ((name || file).endsWith('.tar.bz2')) {
    return extractTar(file, undefined, 'xj');
  } else {
    return extractTar(file);
  }
}

function archiveBaseName(name: string): string {
  return name.match(/^(.*?)(?:\.(?:zip|tar\.gz|tar\.bz2))?$/)![1];
}

function temporaryFileName(prefix: string, suffix: string): string {
  const name = prefix + crypto.randomBytes(8).toString('base64url') + suffix;
  return path.join(tmpdir(), name);

}

function exec(command: string, args: readonly string[]): Promise<number> {
  const subprocess = child_process.spawn(command, args, { stdio: 'inherit' });
  return new Promise((resolve, reject) => {
    subprocess.on('error', (err) => {
      reject(err);
    });

    subprocess.on('close', (exitCode, signal) => {
      if (exitCode !== null) {
        resolve(exitCode);
      } else if (signal !== null) {
        reject(new Error(`${path.basename(command)} terminated from ${signal}`));
      }
    })
  });
}

/**
 * Start a process that will potentially remain running after this process exits.
 * @returns process PID
 */
async function startDaemon(command: string, args: readonly string[], logPath: string): Promise<number> {
  const flag = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW;
  const logFile = await fs.open(logPath, flag);
  try {
    const logFileStream = logFile.createWriteStream();
    const subprocess = child_process.spawn(command, args, {
      detached: true,
      stdio: [null, logFileStream, logFileStream],
    });
    return new Promise((resolve, reject) => {
      subprocess.on('error', (err) => {
        reject(err);
      });

      subprocess.on('spawn', () => {
        if (subprocess.pid === undefined) {
          reject(new Error(`no pid after ${path.basename(command)} spawned`));
          return;
        }

        subprocess.unref();
        resolve(subprocess.pid);
      })
    });
  } finally {
    await logFile.close();
  }
}

(async () => {
  const octokit = getOctokit(core.getInput('github-token', { required: true }));

  const version = core.getInput('zb-version');
  const graphqlRequest =
    version ?
      {
        query:
          `
          query releaseAssetsForVersion($tagName: String!) {
            repository(owner: "256lights", name: "zb") {
              release(tagName: $tagName) {
                ...releaseFields
              }
            }
          }

          ${releaseFragment}
          `,
        tagName: 'v' + version,
      } :
      {
        query:
          `
          query releaseAssetsForLatest {
            repository(owner: "256lights", name: "zb") {
              release: latestRelease {
                ...releaseFields
              }
            }
          }

          ${releaseFragment}
          `,
      };
  const graphqlResponse = await octokit.graphql<{
    repository: {
      release: Release | null;
    }
  }>(graphqlRequest);
  const release = graphqlResponse.repository.release;
  const releaseAssets = release?.releaseAssets?.nodes || [];

  let asset: ReleaseAsset | undefined;
  if (process.platform === 'darwin' && process.arch === 'arm64') {
    asset = releaseAssets.find(({ name }) => name.includes('aarch64-apple-macos'))
  } else if (process.platform === 'linux' && process.arch === 'x64') {
    asset = releaseAssets.find(({ name }) => name.includes('x86_64-unknown-linux'))
  }
  if (!asset) {
    core.setFailed(`No download found for ${process.arch}-${process.platform} version ${release?.tagName || version}`);
    return;
  }

  const zbExtractedFolderPath = await core.group(`Downloading ${asset.downloadUrl}`, async () => {
    const zbArchivePath = await downloadTool(asset.downloadUrl);
    return extractArchive(zbArchivePath, asset.name);
  });

  const useRoot = core.getBooleanInput('use-root');
  const installerPath = path.join(zbExtractedFolderPath, archiveBaseName(asset.name), 'install');
  await core.group('Running installer', () => {
    if (useRoot) {
      return exec('sudo', [
        installerPath,
        '--bin=',
        '--no-systemd',
        '--no-launchd',
      ]);
    } else {
      return exec(installerPath, [
        '--single-user',
        '--bin=',
        '--no-systemd',
        '--no-launchd',
      ]);
    }
  });

  const installerStorePath = path.join(zbExtractedFolderPath, archiveBaseName(asset.name), 'store');
  const objectNames = await fs.readdir(installerStorePath);
  const zbStoreDirectory = process.platform === 'win32' ? 'C:\\zb\\store' : '/opt/zb/store';
  const zbBins = await Promise.all(
    objectNames
      .filter((name) => name.match(/-zb-/))
      .map(async (name) => {
        const binPath = path.join(zbStoreDirectory, name, 'bin');
        try {
          await fs.lstat(binPath);
        } catch {
          return null;
        }
        return binPath;
      })
  );
  for (const binPath of zbBins) {
    if (binPath) {
      core.addPath(binPath);
    }
  }

  if (core.getBooleanInput('zb-serve') && zbBins[0]) {
    const logFilePath = temporaryFileName('zb-serve-', '.txt');
    const serveArgs = [
      'serve',
      `--sandbox=${useRoot && process.platform === 'linux' ? '1' : '0'}`,
    ];
    let pid: number | undefined;
    try {
      pid = useRoot ?
        await startDaemon('sudo', [path.join(zbBins[0], 'zb'), ...serveArgs], logFilePath) :
        await startDaemon(path.join(zbBins[0], 'zb'), serveArgs, logFilePath);
    } catch (err) {
      core.error(typeof err === 'string' || err instanceof Error ?
        err :
        Object.prototype.toString.call(err));
    }
    if (pid) {
      core.info(`Started zb serve with PID ${pid}`)
      core.saveState(servePIDKey, pid);
      core.saveState(serveLogFilePathKey, logFilePath);
    }
  }
})();
