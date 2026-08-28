import { isDeepStrictEqual } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { compareCompatibility } from './compatibility-report.js';
import { schemaFingerprint } from './schema-fingerprint.js';

const metadataSchema = z.object({
  operation: z.string().min(1),
  parserVersion: z.string().min(1),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  requiredPaths: z.array(z.string()),
});

export type FixtureParser = (upstream: unknown) => unknown;
export type FixtureParserRegistry = Readonly<Record<string, FixtureParser>>;

export interface FixtureReplayResult {
  fixture: string;
  operation: string;
  parserVersion: string;
  outputMatches: boolean;
  compatibility: 'healthy' | 'compatible_drift' | 'breaking_drift';
  error?: string;
}

async function discoverMetadata(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return discoverMetadata(path);
      return Promise.resolve(entry.name === 'metadata.json' ? [path] : []);
    }),
  );
  return nested.flat().sort();
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

export async function replayFixtures(
  root: string,
  parsers: FixtureParserRegistry,
): Promise<FixtureReplayResult[]> {
  const metadataFiles = await discoverMetadata(root);
  return Promise.all(
    metadataFiles.map(async (metadataPath) => {
      const fixture = metadataPath.slice(0, -'/metadata.json'.length);
      try {
        const metadata = metadataSchema.parse(await readJson(metadataPath));
        const parser = parsers[metadata.operation];
        if (!parser) {
          return {
            fixture,
            operation: metadata.operation,
            parserVersion: metadata.parserVersion,
            outputMatches: false,
            compatibility: 'breaking_drift' as const,
            error: 'No parser is registered for this operation',
          };
        }
        const upstream = await readJson(join(fixture, 'upstream.json'));
        const expected = await readJson(join(fixture, 'expected.json'));
        const actual = parser(upstream);
        const compatibility = compareCompatibility(schemaFingerprint(upstream), metadata);
        return {
          fixture,
          operation: metadata.operation,
          parserVersion: metadata.parserVersion,
          outputMatches: isDeepStrictEqual(actual, expected),
          compatibility: compatibility.status,
          ...(isDeepStrictEqual(actual, expected) ? {} : { error: 'Golden output mismatch' }),
        };
      } catch (error) {
        return {
          fixture,
          operation: 'unknown',
          parserVersion: 'unknown',
          outputMatches: false,
          compatibility: 'breaking_drift' as const,
          error: error instanceof Error ? error.message : 'Unknown replay error',
        };
      }
    }),
  );
}
