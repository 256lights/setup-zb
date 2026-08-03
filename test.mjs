/**
 * @license
 * Copyright 2026 The zb Authors
 * SPDX-License-Identifier: MIT
 */

import process from 'node:process';
import test from 'node:test';
import { spec } from 'node:test/reporters';

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/**/*.test.ts'],
  bundle: true,
  minify: false,
  platform: 'node',
  target: ['node24.0'],
  format: 'cjs',
  outdir: 'test',
  outbase: 'src',
  outExtension: {'.js' : '.cjs'},
});

test.run({ globPatterns: ['test/**/*.cjs'] })
  .on('test:fail', () => {
    process.exitCode = 1;
  })
  .compose(spec)
  .pipe(process.stdout);
