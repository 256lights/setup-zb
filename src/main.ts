/**
 * @license
 * Copyright 2026 The zb Authors
 * SPDX-License-Identifier: MIT
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { downloadTool, extractTar, extractZip } from '@actions/tool-cache';

import { createConfigurationFiles, getConfigurationInputs, joinPathList } from './config.ts';
import { serveLogFilePathKey, servePIDKey, versionKey } from './shared.ts';
import { exec, startDaemon } from './exec.ts';
import { temporaryFileName } from './temporary.ts';
import { collectServeArguments } from './serve.ts';

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

(async () => {
  const configFiles = await createConfigurationFiles(getConfigurationInputs());
  if (configFiles.length > 0) {
    core.exportVariable('ZB_CONFIG_FILE', joinPathList(configFiles));
  }

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
  if (core.platform.isMacOS && core.platform.arch === 'arm64') {
    asset = releaseAssets.find(({ name }) => name.includes('aarch64-apple-macos'))
  } else if (core.platform.isLinux && core.platform.arch === 'x64') {
    asset = releaseAssets.find(({ name }) => name.includes('x86_64-unknown-linux'))
  }
  if (!release || !asset) {
    core.setFailed(`No download found for ${core.platform.arch}-${core.platform.platform} version ${release?.tagName || version}`);
    return;
  }

  const zbExtractedFolderPath = await core.group(`Downloading ${asset.downloadUrl}`, async () => {
    const zbArchivePath = await downloadTool(asset.downloadUrl);
    return await extractArchive(zbArchivePath, asset.name);
  });

  const useRoot = core.getBooleanInput('use-root');
  const installerPath = path.join(zbExtractedFolderPath, archiveBaseName(asset.name), 'install');
  await core.group('Running installer', () => {
    const installerArgs = [
      '--bin', '',
      '--no-systemd',
      '--no-launchd',
    ];
    if (useRoot) {
      return exec('sudo', ['--non-interactive', '--preserve-env', installerPath, ...installerArgs]);
    } else {
      return exec(installerPath, ['--single-user', ...installerArgs]);
    }
  });
  core.saveState(versionKey, release.tagName);

  const installerStorePath = path.join(zbExtractedFolderPath, archiveBaseName(asset.name), 'store');
  const objectNames = await fs.readdir(installerStorePath);
  const zbStoreDirectory = core.platform.isWindows ? 'C:\\zb\\store' : '/opt/zb/store';
  const zbStoreObjects = await Promise.all(
    objectNames
      .filter((name) => name.match(/-zb-/))
      .map(async (name) => {
        const storePath = path.join(zbStoreDirectory, name);
        const binPath = path.join(storePath, 'bin');
        try {
          await fs.lstat(binPath);
        } catch {
          return null;
        }
        return storePath;
      })
  );
  let firstZBStoreObject: string | undefined
  for (const storePath of zbStoreObjects) {
    if (storePath) {
      core.addPath(path.join(storePath, 'bin'));
      if (!firstZBStoreObject) {
        firstZBStoreObject = storePath;
      }
    }
  }

  if (core.getBooleanInput('zb-serve') && firstZBStoreObject) {
    const logFilePath = temporaryFileName('zb-serve-*.txt');
    const { command: zbExe, args: serveArgs } = await collectServeArguments(firstZBStoreObject, { useRoot });
    let pid: number | undefined;
    try {
      pid = useRoot ?
        await startDaemon('sudo', ['--non-interactive', '--preserve-env', zbExe, ...serveArgs], logFilePath) :
        await startDaemon(zbExe, serveArgs, logFilePath);
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
