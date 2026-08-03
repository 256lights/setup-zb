import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import * as core from '@actions/core';

export interface ConfigurationInputs {
  'configuration': string;
  'signing-key': string;
}

export function getConfigurationInputs(): ConfigurationInputs {
  return {
    configuration: core.getInput('configuration'),
    'signing-key': core.getInput('signing-key'),
  }
}

/**
 * @returns A list of configuration files in descending precedence order.
 */
export async function createConfigurationFiles(inputs: ConfigurationInputs): Promise<string[]> {
  if (!inputs.configuration && !inputs['signing-key']) {
    return [];
  }

  const configFiles = [];
  const configDir = await fs.mkdtemp(path.join(tmpdir(), 'zb-config-'));

  if (inputs['signing-key']) {
    const keyPath = path.join(configDir, 'signing-key.json');
    await fs.writeFile(keyPath, inputs['signing-key'], {
      encoding: 'utf-8',
    });
    const p = path.join(configDir, 'action.json');
    const configObject = {
      server: {
        signingKeyFiles: ['signing-key.json'],
      }
    };
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
