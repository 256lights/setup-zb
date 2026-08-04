// Copyright 2026 The zb Authors
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import process from 'node:process';
import { describe, it } from 'node:test';

import { exec, startDaemon, waitForProcessToExit } from './exec';
import { temporaryFileName } from './temporary';

const trueCommand = process.platform === 'win32'
  ? {command: 'powershell.exe', args: ['-Command', '']}
  : {command: 'true', args: []};

const falseCommand = process.platform === 'win32'
  ? {command: 'powershell.exe', args: ['-Command', 'throw "Foo"']}
  : {command: 'false', args: []};

const echoCommand = process.platform === 'win32'
  ? {command: 'powershell.exe', args: ['-Command', 'echo "Hello, World!"']}
  : {command: 'echo', args: ['Hello, World!']};

describe('exec', () => {
  it('fulfills on a successful command', async () => {
    await assert.doesNotReject(exec(trueCommand.command, trueCommand.args));
  });

  it('rejects on a failed command', async () => {
    await assert.rejects(exec(falseCommand.command, falseCommand.args));
  });
});

describe('startDaemon', () => {
  it('writes process output to a log file', async () => {
    const logFilePath = temporaryFileName('testlog-*.txt');
    const pid = await startDaemon(echoCommand.command, echoCommand.args, logFilePath);
    await waitForProcessToExit(pid);

    const gotOutput = await fs.readFile(logFilePath, { encoding: 'utf-8' });
    assert.equal(gotOutput, 'Hello, World!\n');
  });
});
