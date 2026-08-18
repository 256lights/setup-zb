// Copyright 2026 The zb Authors
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import path from 'node:path';
import process from 'node:process';
import { tmpdir } from 'node:os';
import { describe, it } from 'node:test';

import { temporaryFileName } from './temporary.ts';

describe('temporaryFileName', () => {
  it('uses tmpdir by default', () => {
    const got = temporaryFileName('');
    assert.ok(got.startsWith(tmpdir() + path.sep), `got ${got}; want to start with ${tmpdir()}`);
  });

  it('uses a directory if given', () => {
    const dir = process.platform === 'win32' ? 'C:\\foo' : '/foo';
    const got = temporaryFileName(dir, '');
    assert.ok(got.startsWith(dir + path.sep), `got ${got}; want to start with ${dir}${path.sep}`);
  });

  it('returns a unique name each call', () => {
    const got1 = temporaryFileName('');
    const got2 = temporaryFileName('');
    assert.notEqual(got2, got1);
  });

  it('uses the prefix', () => {
    const got = temporaryFileName('foo');
    assert.ok(got.startsWith(tmpdir() + path.sep + 'foo'), `got ${got}; want to start with ${tmpdir()}${path.sep}foo`);
  });

  it('uses the prefix when has asterisk', () => {
    const got = temporaryFileName('foo*');
    assert.ok(got.startsWith(tmpdir() + path.sep + 'foo'), `got ${got}; want to start with ${tmpdir()}${path.sep}foo`);
  });

  it('uses the suffix when has asterisk', () => {
    const got = temporaryFileName('*.txt');
    assert.ok(got.endsWith('.txt'), `got ${got}; want to end with .txt`);
  });
});
