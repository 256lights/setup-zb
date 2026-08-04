import fs from 'node:fs/promises';
import path from 'node:path';

import * as core from '@actions/core';

import { mkdirTemp } from './temporary';

interface ZBConfiguration {
  server?: ZBServerConfiguration;
}

interface ZBServerConfiguration {
  download?: StoreLocator;
  upload?: StoreLocator;
  signingKeyFiles?: string[];
}

type StoreLocator = NullStoreLocator | HTTPStoreLocator;

type NullStoreLocator = null | {type: 'null'};

interface HTTPStoreLocator {
  type: 'http';
  url: string;
}

export interface ConfigurationInputs {
  'configuration': string;
  'signing-key': string;
  'server-download-discovery': string;
  'server-upload-discovery': string;
}

export function getConfigurationInputs(): ConfigurationInputs {
  const inputs: Partial<ConfigurationInputs> = {};
  const keys: (keyof ConfigurationInputs)[] = [
    'configuration',
    'signing-key',
    'server-download-discovery',
    'server-upload-discovery',
  ];
  for (const key of keys) {
    inputs[key] = core.getInput(key);
  }
  return inputs as ConfigurationInputs;
}

function hasGenerated(inputs: ConfigurationInputs): boolean {
  return !!inputs['signing-key'] ||
    !!inputs['server-download-discovery'] ||
    !!inputs['server-upload-discovery'];
}

/**
 * @returns A list of configuration files in descending precedence order.
 */
export async function createConfigurationFiles(inputs: ConfigurationInputs): Promise<string[]> {
  if (!inputs.configuration && !hasGenerated(inputs)) {
    return [];
  }

  const configFiles = [];
  const configDir = await mkdirTemp('zb-config-');

  if (hasGenerated(inputs)) {
    const serverConfig: ZBServerConfiguration = {};

    if (inputs['signing-key']) {
      const keyPath = path.join(configDir, 'signing-key.json');
      await fs.writeFile(keyPath, inputs['signing-key'], {
        encoding: 'utf-8',
      });
      serverConfig.signingKeyFiles = ['signing-key.json'];
    }
    if (inputs['server-download-discovery']) {
      const keyPath = path.join(configDir, 'download-discovery.json');
      await fs.writeFile(keyPath, inputs['server-download-discovery'], {
        encoding: 'utf-8',
      });
      serverConfig.download = {
        type: 'http',
        url: 'download-discovery.json',
      };
    }
    if (inputs['server-upload-discovery']) {
      const keyPath = path.join(configDir, 'upload-discovery.json');
      await fs.writeFile(keyPath, inputs['server-upload-discovery'], {
        encoding: 'utf-8',
      });
      serverConfig.upload = {
        type: 'http',
        url: 'upload-discovery.json',
      };
    }

    const configObject: ZBConfiguration = {server: serverConfig};
    const p = path.join(configDir, 'action.json');
    await fs.writeFile(p, JSON.stringify(configObject), {
      encoding: 'utf-8',
    });
    configFiles.push(p);
  }

  if (inputs.configuration) {
    const p = path.join(configDir, 'user.json');
    await fs.writeFile(p, inputs.configuration, {
      encoding: 'utf-8',
    });
    configFiles.push(p);
  }

  return configFiles;
}

/**
 * Return a string for a list of paths using the OS-specific list separator.
 * @returns The joined string.
 */
export function joinPathList(paths: readonly string[]): string {
  return paths.join(core.platform.isWindows ? ';' : ':');
}
