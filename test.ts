/**
 * @license
 * Copyright 2026 The zb Authors
 * SPDX-License-Identifier: MIT
 */

import process from 'node:process';
import test from 'node:test';
import { spec } from 'node:test/reporters';

test.run({ globPatterns: ['src/**/*.test.ts'] })
  .on('test:fail', () => {
    process.exitCode = 1;
  })
  .compose(spec)
  .pipe(process.stdout);
