// Copyright 2026 The zb Authors
// SPDX-License-Identifier: MIT

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { collectServeArguments, type ServeArgsOptions } from './serve';
import { mkdirTemp } from './temporary';

describe('collectServeArguments', () => {
  let tempDir: string;
  let emptyDir: string;
  let linuxDir: string;
  let macOSDir: string;
  before(async () => {
    tempDir = await mkdirTemp('setup-zb-serve-test-*');

    emptyDir = path.join(tempDir, 'empty');
    await fs.mkdir(emptyDir);

    linuxDir = path.join(tempDir, 'linux');
    const systemdDirectory = path.join(linuxDir, 'lib', 'systemd', 'system');
    await fs.mkdir(systemdDirectory, { recursive: true });
    await fs.writeFile(
      path.join(systemdDirectory, 'zb-serve.service'),
      '[Unit]\n' +
      'Description=zb Store Server\n' +
      '[Service]\n' +
      `ExecStart=${linuxDir}/bin/zb serve --systemd --sandbox-path=/bin/sh=/opt/zb/store/hpsxd175dzfmjrg27pvvin3nzv3yi61k-busybox-1.36.1/bin/sh --implicit-system-dep=/bin/sh --build-users-group=zbld $ZB_SERVE_FLAGS\n`,
    );

    macOSDir = path.join(tempDir, 'macos');
    const launchdDirectory = path.join(macOSDir, 'Library', 'LaunchDaemons');
    await fs.mkdir(launchdDirectory, { recursive: true });
    await fs.writeFile(
      path.join(launchdDirectory, 'dev.zb-build.serve.plist'),
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
      '<plist version="1.0">\n' +
      '<dict>\n' +
      '<key>Label</key>\n' +
      '<string>dev.zb-build.serve</string>\n' +
      '<key>KeepAlive</key>\n' +
      '<true/>\n' +
      '<key>RunAtLoad</key>\n' +
      '<true/>\n' +
      '<key>ProgramArguments</key>\n' +
      '<array>\n' +
      `<string>${macOSDir}/bin/zb</string>\n` +
      '<string>serve</string>\n' +
      '<string>--sandbox-path=/usr</string>\n' +
      '<string>--sandbox-path=/bin</string>\n' +
      '<string>--sandbox-path=/Library/Developer/CommandLineTools</string>\n' +
      '</array>\n' +
      '<key>StandardErrorPath</key>\n' +
      '<string>/opt/zb/var/log/zb-serve.log</string>\n' +
      '<key>StandardOutPath</key>\n' +
      '<string>/dev/null</string>\n' +
      '</dict>\n' +
      '</plist>\n',
    );
  });

  after(async () => {
    await fs.rm(tempDir, { force: true, recursive: true });
  });

  describe('on Linux', () => {
    const linuxServeArgs = (prefix: string, options: Omit<ServeArgsOptions, 'platform'>) =>
      collectServeArguments(prefix, {
        ...options,
        platform: {
          isLinux: true,
          isMacOS: false,
          isWindows: false,
        },
      });

    it('should use the zb in bin', async () => {
      const got = await linuxServeArgs(emptyDir, { useRoot: true });
      assert.equal(path.normalize(got.command), path.normalize(path.join(emptyDir, 'bin', 'zb')));
    });

    it('should sandbox with root', async () => {
      const got = await linuxServeArgs(emptyDir, { useRoot: true });
      assert.ok(got.args.includes('--sandbox=1'));
    });

    it('should not sandbox without root', async () => {
      const got = await linuxServeArgs(emptyDir, { useRoot: false });
      assert.ok(got.args.includes('--sandbox=0'));
    });

    it('should start with a serve argument', async () => {
      const got = await linuxServeArgs(emptyDir, { useRoot: false });
      assert.equal(got.args[0], 'serve');
    });

    it('should include sandbox arguments from systemd configuration', async () => {
      const got = await linuxServeArgs(linuxDir, { useRoot: false });
      assert.ok(got.args.includes('--sandbox-path=/bin/sh=/opt/zb/store/hpsxd175dzfmjrg27pvvin3nzv3yi61k-busybox-1.36.1/bin/sh'));
      assert.ok(got.args.includes('--implicit-system-dep=/bin/sh'));
    });

    it('should not include --systemd', async () => {
      const got = await linuxServeArgs(linuxDir, { useRoot: false });
      assert.ok(!got.args.includes('--systemd'));
    });
  });

  describe('on macOS', () => {
    const macOSServeArgs = (prefix: string, options: Omit<ServeArgsOptions, 'platform'>) =>
      collectServeArguments(prefix, {
        ...options,
        platform: {
          isLinux: false,
          isMacOS: true,
          isWindows: false,
        },
      });

    it('should use the zb in bin', async () => {
      const got = await macOSServeArgs(emptyDir, { useRoot: true });
      assert.equal(path.normalize(got.command), path.normalize(path.join(emptyDir, 'bin', 'zb')));
    });

    it('should not sandbox with root', async () => {
      const got = await macOSServeArgs(emptyDir, { useRoot: true });
      assert.ok(got.args.includes('--sandbox=0'));
    });

    it('should not sandbox without root', async () => {
      const got = await macOSServeArgs(emptyDir, { useRoot: false });
      assert.ok(got.args.includes('--sandbox=0'));
    });

    it('should start with a serve argument', async () => {
      const got = await macOSServeArgs(emptyDir, { useRoot: false });
      assert.equal(got.args[0], 'serve');
    });

    it('should include sandbox arguments from launchd configuration', async () => {
      const got = await macOSServeArgs(macOSDir, { useRoot: false });
      assert.ok(got.args.includes('--sandbox-path=/usr'));
      assert.ok(got.args.includes('--sandbox-path=/bin'));
      assert.ok(got.args.includes('--sandbox-path=/Library/Developer/CommandLineTools'));
    });
  });
});
