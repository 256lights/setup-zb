// Copyright 2026 The zb Authors
// SPDX-License-Identifier: MIT

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Generates a new pathname by adding a random string to the end of pattern.
 * If pattern includes a "*", the random string replaces the last "*" instead.
 * @param dir directory prefix (defaults to OS temporary directory)
 * @returns the file path
 */
export function temporaryFileName(pattern: string): string;
export function temporaryFileName(dir: string | undefined, pattern: string): string;
export function temporaryFileName(dirOrPattern: string | undefined, pattern?: string): string {
  const dir = pattern === undefined || !dirOrPattern ? tmpdir() : dirOrPattern;
  const [prefix, suffix] = splitPattern(pattern ?? (dirOrPattern || ''));
  const name = prefix + crypto.randomBytes(8).toString('base64url') + suffix;
  return path.join(dir, name);
}

/**
 * Creates a new temporary directory and returns the pathname of the new directory. 
 * If pattern includes a "*", the random string replaces the last "*" instead.
 * The directory is created with mode 0o700 (before umask).
 * @param dir directory to create in (defaults to OS temporary directory)
 * @returns the file path
 */
export function mkdirTemp(pattern: string): Promise<string>;
export function mkdirTemp(dir: string | undefined, pattern: string): Promise<string>;
export function mkdirTemp(dirOrPattern: string | undefined, pattern?: string): Promise<string> {
  const dir = pattern !== undefined ? dirOrPattern : undefined;
  const name = temporaryFileName(dir, pattern ?? (dirOrPattern || ''));
  return fs.mkdir(name, 0o700).then(() => name);
}

function splitPattern(pattern: string): [string, string] {
  const match = pattern.match(/^(.*)\*([^*]*)$/);
  if (match) {
    return [match[1], match[2]];
  }
  return [pattern, ''];
}
