/**
 * @license
 * Copyright 2026 The zb Authors
 * SPDX-License-Identifier: MIT
 */

import fs from 'node:fs/promises';
import process from 'node:process';
import type { Readable } from 'node:stream';
import stream from 'node:stream/promises';

import * as core from '@actions/core';
import semver from 'semver';

import { waitForProcessToExit } from './exec';
import { serveLogFilePathKey, servePIDKey, versionKey } from './shared';
import { tail } from './tail';

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

async function shutDownServer(pid: number, logFilePath?: string, version?: string): Promise<void> {
  // Start with graceful shutdown: instruct the server to stop accepting new work,
  // and exit after finishing any current work.
  const v = semver.coerce(version);
  const supportsSIGUSR2 = v && semver.gte(v, '0.2.0-beta1');
  const firstSignal = supportsSIGUSR2 ? 'SIGUSR2' : 'SIGTERM';
  try {
    process.kill(pid, firstSignal);
  } catch {
    // Already exited.
    return;
  }
  core.info(`Sent ${firstSignal} to process ${pid}`);

  // After 30 minutes (enough time to upload everything), send SIGTERM.
  const abort = new AbortController();
  const tailPromise =
    logFilePath
      ? pipeLogs(tail(logFilePath, abort.signal))
      : Promise.resolve();
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
    await exitPromise;
  } finally {
    abort.abort();
    await Promise.allSettled([exitPromise, waitPromise, tailPromise]);
  }
}

async function pipeLogs(source: Readable): Promise<void> {
  core.startGroup('Server logs');
  try {
    await stream.pipeline(source, process.stdout, { end: false });
  } finally {
    core.endGroup();
  }
}

(async () => {
  const logFilePath = core.getState(serveLogFilePathKey);
  try {
    const pidString = core.getState(servePIDKey);
    if (pidString) {
      const pid = parseInt(pidString, 10);
      await shutDownServer(pid, logFilePath, core.getState(versionKey));
      core.info('Server shut down.');
    } else if (logFilePath) {
      const f = await fs.open(logFilePath);
      await pipeLogs(f.createReadStream());
    }
  } finally {
    await fs.unlink(logFilePath);
  }
})();
