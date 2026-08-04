/**
 * @license
 * Copyright 2026 The zb Authors
 * SPDX-License-Identifier: MIT
 */

import fs from 'node:fs/promises';
import process from 'node:process';
import stream from 'node:stream/promises';

import * as core from '@actions/core';

import { waitForProcessToExit } from './exec';
import { serveLogFilePathKey, servePIDKey } from './shared';

function sleep(delay: number, abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let id: NodeJS.Timeout;
    const abortListener = () => {
      clearTimeout(id);
      reject(abortSignal?.reason);
    };
    if (abortSignal) {
      abortSignal.addEventListener('abort', abortListener);
    }
    id = setTimeout(() => {
      if (abortSignal) {
        abortSignal.removeEventListener('abort', abortListener);
      }
      resolve();
    }, delay);
  });
}

async function shutDownServer(pid: number): Promise<void> {
  // Start with graceful shutdown: instruct the server to stop accepting new work,
  // and exit after finishing any current work.
  try {
    process.kill(pid, 'SIGUSR2');
  } catch {
    // Already exited.
    return;
  }
  core.info(`Sent SIGUSR2 to process ${pid}`);

  // After 30 minutes (enough time to upload everything), send SIGTERM.
  const abort = new AbortController();
  const exitPromise = waitForProcessToExit(pid, abort.signal);
  const waitPromise = sleep(30 * 60 * 1000, abort.signal);
  try {
    const finished = await Promise.race([
      exitPromise.then(() => true),
      waitPromise.then(() => false),
    ]);
    if (finished) {
      return;
    }
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already exited.
      return;
    }
    core.info(`Sent SIGTERM to process ${pid}`);
    await exitPromise;
  } finally {
    abort.abort();
    await Promise.allSettled([exitPromise, waitPromise]);
  }
}

(async () => {
  const pidString = core.getState(servePIDKey);
  if (pidString) {
    const pid = parseInt(pidString, 10);
    await shutDownServer(pid);
    core.info('Server shut down.');
  }

  const logFilePath = core.getState(serveLogFilePathKey);
  if (logFilePath) {
    try {
      await core.group('Server logs', async () => {
        const f = await fs.open(logFilePath);
        await stream.pipeline(f.createReadStream(), process.stdout, { end: false });
      });
    } finally {
      await fs.unlink(logFilePath);
    }
  }
})();
