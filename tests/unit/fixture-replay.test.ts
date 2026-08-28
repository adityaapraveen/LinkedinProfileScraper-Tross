import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { replayFixtures } from '../../src/linkedin/diagnostics/fixture-replay.js';
import { schemaFingerprint } from '../../src/linkedin/diagnostics/schema-fingerprint.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

async function fixture(expected: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'protocol-fixture-'));
  temporaryDirectories.push(root);
  const directory = join(root, 'identity', 'synthetic');
  await mkdir(directory, { recursive: true });
  const upstream = { data: { label: 'Synthetic Value' } };
  await Promise.all([
    writeFile(join(directory, 'upstream.json'), JSON.stringify(upstream)),
    writeFile(join(directory, 'expected.json'), JSON.stringify(expected)),
    writeFile(
      join(directory, 'metadata.json'),
      JSON.stringify({
        operation: 'identity.v1',
        parserVersion: 'identity-parser.v1',
        fingerprint: schemaFingerprint(upstream).hash,
        requiredPaths: ['$.data.label:string'],
      }),
    ),
  ]);
  return root;
}

describe('fixture replay', () => {
  it('passes matching golden output and fingerprint', async () => {
    const root = await fixture({ name: 'Synthetic Value' });
    const results = await replayFixtures(root, {
      'identity.v1': (input) => ({
        name: (input as { data: { label: string } }).data.label,
      }),
    });
    expect(results).toMatchObject([{ outputMatches: true, compatibility: 'healthy' }]);
  });

  it('reports golden output failures', async () => {
    const root = await fixture({ name: 'Different Value' });
    const results = await replayFixtures(root, {
      'identity.v1': () => ({ name: 'Synthetic Value' }),
    });
    expect(results).toMatchObject([{ outputMatches: false, error: 'Golden output mismatch' }]);
  });

  it('reports unregistered parsers', async () => {
    const root = await fixture({});
    const results = await replayFixtures(root, {});
    expect(results).toMatchObject([{ outputMatches: false, compatibility: 'breaking_drift' }]);
  });
});
