// Copyright 2026 The zb Authors
// SPDX-License-Identifier: MIT

import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Executes a subprocess attached to the current process's input and output streams.
 * @returns A promise that fulfills when the subprocess exits successfully and rejects otherwise.
 */
export function exec(command: string, args: readonly string[]): Promise<void> {
  const subprocess = child_process.spawn(command, args, { stdio: 'inherit' });
  return new Promise((resolve, reject) => {
    subprocess.on('error', (err) => {
      reject(err);
    });

    subprocess.on('close', (exitCode, signal) => {
      if (exitCode === 0) {
        resolve();
      } else if (exitCode !== null) {
        reject(new Error(`${path.basename(command)} terminated with exit code ${exitCode}`));
      } else if (signal !== null) {
        reject(new Error(`${path.basename(command)} terminated from ${signal}`));
      }
    })
  });
}

/**
 * Start a process that will potentially remain running after this process exits.
 * @returns A promise that fulfills with the daemon process's PID.
 */
export async function startDaemon(command: string, args: readonly string[], logPath: string): Promise<number> {
  const flag = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW;
  const logFile = await fs.open(logPath, flag);
  try {
    const logFileStream = logFile.createWriteStream();
    const subprocess = child_process.spawn(command, args, {
      detached: true,
      stdio: [null, logFileStream, logFileStream],
    });
    return await new Promise((resolve, reject) => {
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
    try {
      await logFile.close();
    } catch {}
  }
}

/**
 * Returns a promise that fulfills after a process with the pid exits.
 * @param abortSignal Optional signal to reject the promise early.
 */
export function waitForProcessToExit(pid: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let id: NodeJS.Timeout;
    const abortListener = () => {
      clearInterval(id);
      reject(abortSignal?.reason);
    };
    if (abortSignal) {
      abortSignal.addEventListener('abort', abortListener);
    }

    id = setInterval(() => {
      try {
        process.kill(pid, 0);
      } catch {
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortListener);
        }
        clearInterval(id);
        resolve();
      }
    }, 500);
  });
}
