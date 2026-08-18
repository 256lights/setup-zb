// Copyright 2026 The zb Authors
// SPDX-License-Identifier: MIT

import fs from 'node:fs/promises';
import path from 'node:path';

import * as core from '@actions/core';
import { parse as parsePlist, type PlistValue } from 'plist';

export interface ServeArgsOptions {
  useRoot: boolean
  platform?: Platform
}

export interface Platform {
  isLinux: boolean;
  isMacOS: boolean;
  isWindows: boolean;
}

export async function collectServeArguments(prefix: string, options: ServeArgsOptions): Promise<{ command: string, args: string[] }> {
  const command = path.join(prefix, 'bin', 'zb');
  const platform: Platform = options.platform || core.platform;
  const args = ['serve'];
  args.push(`--sandbox=${options.useRoot && platform.isLinux ? '1' : '0'}`);

  if (platform.isLinux) {
    let systemdUnit = '';
    try {
      systemdUnit = await fs.readFile(path.join(prefix, 'lib', 'systemd', 'system', 'zb-serve.service'), {
        encoding: 'utf-8',
      });
    } catch {
    }
    const execStartPrefix = 'ExecStart=';
    const execStartLine = systemdUnit.split('\n').find((line) => line.startsWith(execStartPrefix));
    if (execStartLine) {
      const argv = execStartLine.substring(execStartPrefix.length).split(/\s+/);
      addUsefulArgs(args, argv.slice(1));
    }
  } else if (platform.isMacOS) {
    let launchDaemonData: Buffer | undefined;
    try {
      launchDaemonData = await fs.readFile(path.join(prefix, 'Library', 'LaunchDaemons', 'dev.zb-build.serve.plist'));
    } catch {
    }
    if (launchDaemonData) {
      const launchDaemon = parseAnyPlist(launchDaemonData);
      addUsefulArgs(args, launchDaemonProgramArguments(launchDaemon));
    }
  }

  return { command, args };
}

function parseAnyPlist(data: string | Uint8Array): PlistValue {
  return parsePlist(typeof data === 'string' || data.includes(0)
    ? data
    : new TextDecoder().decode(data));
}

function addUsefulArgs(dst: string[], src: readonly string[]): void {
  for (const arg of src) {
    if (arg.startsWith('--sandbox-path=') || arg.startsWith('--implicit-system-dep')) {
      dst.push(arg);
    }
  }
}

function launchDaemonProgramArguments(launchDaemon: PlistValue): string[] {
  const stringArgs = [];
  if (launchDaemon &&
    typeof launchDaemon === 'object' &&
    'ProgramArguments' in launchDaemon &&
    launchDaemon.ProgramArguments instanceof Array) {
    for (const arg of launchDaemon.ProgramArguments) {
      if (typeof arg === 'string') {
        stringArgs.push(arg);
      } else {
        stringArgs.push(Object.prototype.toString.call(arg));
      }
    }
  }
  return stringArgs;
}
