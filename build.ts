/**
 * @license
 * Copyright 2026 The zb Authors
 * SPDX-License-Identifier: MIT
 */

import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/main.ts', 'src/post.ts'],
  bundle: true,
  minify: false,
  platform: 'node',
  target: ['node24.0'],
  format: 'cjs',
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
});
