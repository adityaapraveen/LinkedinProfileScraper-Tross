import { resolve } from 'node:path';
import {
  replayFixtures,
  type FixtureParserRegistry,
} from '../src/linkedin/diagnostics/fixture-replay.js';

// Parsers are registered only after a verified sanitized capture defines their response boundary.
const parsers: FixtureParserRegistry = {};
const root = resolve(process.cwd(), 'fixtures/sanitized');
const results = await replayFixtures(root, parsers);

if (results.length === 0) {
  console.log('No sanitized protocol fixtures are present; endpoint parsers remain unsupported.');
} else {
  for (const result of results) {
    console.log(
      `${result.outputMatches ? 'PASS' : 'FAIL'} ${result.operation} ${result.compatibility} ${result.fixture}`,
    );
    if (result.error) console.error(`  ${result.error}`);
  }
}

if (results.some((result) => !result.outputMatches)) process.exitCode = 1;
