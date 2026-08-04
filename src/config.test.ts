import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { before, describe, it } from 'node:test';

import { createConfigurationFiles, joinPathList } from './config';
import type { ConfigurationInputs } from './config';

describe('createConfigurationFiles', () => {
  const emptyInputs: Readonly<ConfigurationInputs> = {
    configuration: '',
    'signing-key': '',
    'server-download-discovery': '',
    'server-upload-discovery': '',
  };

  describe('with empty inputs', () => {
    let got: string[];

    before(async () => {
      got = await createConfigurationFiles(emptyInputs);
    });

    it('should return an empty list', () => {
      assert.equal(got.length, 0, `length is ${got.length}`);
    });
  });

  describe('with configuration', () => {
    const configuration = '{"debug": true}';
    let got: string[];

    before(async () => {
      got = await createConfigurationFiles({
        ...emptyInputs,
        configuration,
      });
    });

    it('should return a single path', () => {
      assert.equal(got.length, 1, `length is ${got.length}`);
    });

    it('should write the configuration to a file', async () => {
      const gotPath = got[0];
      assert.ok(gotPath, 'missing path');
      const gotContent = await fs.readFile(gotPath, { encoding: 'utf-8' });
      assert.equal(gotContent, configuration);
    });
  });

  describe('with signing key', () => {
    const signingKey = '{"format": "foo"}';
    let got: string[];

    before(async () => {
      got = await createConfigurationFiles({
        ...emptyInputs,
        'signing-key': signingKey,
      });
    });

    it('should return a single path', () => {
      assert.equal(got.length, 1, `length is ${got.length}`);
    });

    it('should write a configuration with a signing key', async () => {
      const gotPath = got[0];
      assert.ok(gotPath, 'missing path');
      const gotContent = await fs.readFile(gotPath, { encoding: 'utf-8' });
      const gotJSON = JSON.parse(gotContent);
      assert.equal(typeof gotJSON, 'object', `configuration file is not an object: ${gotContent}`);
      assert.equal(typeof gotJSON.server, 'object', `config.server is not an object: ${gotContent}`);
      const gotSigningKeyFiles = gotJSON.server.signingKeyFiles;
      assert.ok(gotSigningKeyFiles instanceof Array, `config.server.signingKeyFiles is not an array: ${gotContent}`);
      assert.equal(gotSigningKeyFiles.length, 1, `config.server.signingKeyFiles.length is ${gotSigningKeyFiles.length}`);
      assert.equal(typeof gotSigningKeyFiles[0], 'string', `config.server.signingKeyFiles[0] is not a string: ${gotContent}`);

      const gotSigningKeyPath = path.resolve(path.dirname(gotPath), gotSigningKeyFiles[0]);
      const gotKeyContent = await fs.readFile(gotSigningKeyPath, { encoding: 'utf-8' });
      assert.equal(gotKeyContent, signingKey);
    });
  });

  describe('with download discovery', () => {
    const discoveryDocument = '{"_links": {"https://zb-build.dev/api/rel/narinfo": [{"href": "{digest}.narinfo", "templated": true}]}}';
    let got: string[];

    before(async () => {
      got = await createConfigurationFiles({
        ...emptyInputs,
        'server-download-discovery': discoveryDocument,
      });
    });

    it('should return a single path', () => {
      assert.equal(got.length, 1, `length is ${got.length}`);
    });

    it('should write a configuration with a download discovery document', async () => {
      const gotPath = got[0];
      assert.ok(gotPath, 'missing path');
      const gotContent = await fs.readFile(gotPath, { encoding: 'utf-8' });
      const gotJSON = JSON.parse(gotContent);
      assert.equal(typeof gotJSON, 'object', `configuration file is not an object: ${gotContent}`);
      assert.equal(typeof gotJSON.server, 'object', `config.server is not an object: ${gotContent}`);
      const gotDownload = gotJSON.server.download;
      assert.equal(typeof gotDownload, 'object', `config.server.download is not an object: ${gotContent}`);
      assert.equal(gotDownload.type, 'http', `config.server.download.type is not http: ${gotContent}`);
      assert.equal(typeof gotDownload.url, 'string', `config.server.download.url is not a string: ${gotContent}`);

      const gotURL = path.resolve(path.dirname(gotPath), gotDownload.url);
      const gotDiscoveryContent = await fs.readFile(gotURL, { encoding: 'utf-8' });
      assert.equal(gotDiscoveryContent, discoveryDocument);
    });
  });

  describe('with upload discovery', () => {
    const discoveryDocument = '{"_links": {"https://zb-build.dev/api/rel/narinfo": [{"href": "{digest}.narinfo", "templated": true}]}}';
    let got: string[];

    before(async () => {
      got = await createConfigurationFiles({
        ...emptyInputs,
        'server-upload-discovery': discoveryDocument,
      });
    });

    it('should return a single path', () => {
      assert.equal(got.length, 1, `length is ${got.length}`);
    });

    it('should write a configuration with a upload discovery document', async () => {
      const gotPath = got[0];
      assert.ok(gotPath, 'missing path');
      const gotContent = await fs.readFile(gotPath, { encoding: 'utf-8' });
      const gotJSON = JSON.parse(gotContent);
      assert.equal(typeof gotJSON, 'object', `configuration file is not an object: ${gotContent}`);
      assert.equal(typeof gotJSON.server, 'object', `config.server is not an object: ${gotContent}`);
      const gotUpload = gotJSON.server.upload;
      assert.equal(typeof gotUpload, 'object', `config.server.upload is not an object: ${gotContent}`);
      assert.equal(gotUpload.type, 'http', `config.server.upload.type is not http: ${gotContent}`);
      assert.equal(typeof gotUpload.url, 'string', `config.server.upload.url is not a string: ${gotContent}`);

      const gotURL = path.resolve(path.dirname(gotPath), gotUpload.url);
      const gotDiscoveryContent = await fs.readFile(gotURL, { encoding: 'utf-8' });
      assert.equal(gotDiscoveryContent, discoveryDocument);
    });
  });

  describe('with configuration and signing key', () => {
    const configuration = '{"debug": true}';
    const signingKey = '{"format": "foo"}';
    let got: string[];

    before(async () => {
      got = await createConfigurationFiles({
        ...emptyInputs,
        configuration,
        'signing-key': signingKey,
      });
    });

    it('should return two paths', () => {
      assert.equal(got.length, 2, `length is ${got.length}`);
    });

    it('should write a configuration with a signing key to the first file', async () => {
      const gotPath = got[0];
      assert.ok(gotPath, 'missing path');
      const gotContent = await fs.readFile(gotPath, { encoding: 'utf-8' });
      const gotJSON = JSON.parse(gotContent);
      assert.equal(typeof gotJSON, 'object', `configuration file is not an object: ${gotContent}`);
      assert.equal(typeof gotJSON.server, 'object', `config.server is not an object: ${gotContent}`);
      const gotSigningKeyFiles = gotJSON.server.signingKeyFiles;
      assert.ok(gotSigningKeyFiles instanceof Array, `config.server.signingKeyFiles is not an array: ${gotContent}`);
      assert.equal(gotSigningKeyFiles.length, 1, `config.server.signingKeyFiles.length is ${gotSigningKeyFiles.length}`);
      assert.equal(typeof gotSigningKeyFiles[0], 'string', `config.server.signingKeyFiles[0] is not a string: ${gotContent}`);

      const gotSigningKeyPath = path.resolve(path.dirname(gotPath), gotSigningKeyFiles[0]);
      const gotKeyContent = await fs.readFile(gotSigningKeyPath, { encoding: 'utf-8' });
      assert.equal(gotKeyContent, signingKey);
    });

    it('should write the configuration to the second file', async () => {
      const gotPath = got[1];
      assert.ok(gotPath, 'missing second path');
      const gotContent = await fs.readFile(gotPath, { encoding: 'utf-8' });
      assert.equal(gotContent, configuration);
    });
  });
});

describe('joinPathList', () => {
  it('returns an empty string for an empty list', () => {
    assert.equal(joinPathList([]), '');
  });

  it('returns the single element', () => {
    assert.equal(joinPathList(['foo.txt']), 'foo.txt');
  });

  it('returns two elements joined by OS separator', () => {
    const want = `foo.txt${path.delimiter}bar.txt`;
    assert.equal(joinPathList(['foo.txt', 'bar.txt']), want);
  });
});
