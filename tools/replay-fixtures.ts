import { resolve } from 'node:path';
import {
  replayFixtures,
  type FixtureParserRegistry,
} from '../src/linkedin/diagnostics/fixture-replay.js';

// Register parsers here when a privacy-reviewed sanitized replay fixture is committed.
const parsers: FixtureParserRegistry = {};
const root = resolve(process.cwd(), 'fixtures/sanitized');
const results = await replayFixtures(root, parsers);

if (results.length === 0) {
  console.log(
    'No sanitized replay fixtures are present; parser coverage uses synthetic unit fixtures.',
  );
} else {
  for (const result of results) {
    console.log(
      `${result.outputMatches ? 'PASS' : 'FAIL'} ${result.operation} ${result.compatibility} ${result.fixture}`,
    );
    if (result.error) console.error(`  ${result.error}`);
  }
}

if (results.some((result) => !result.outputMatches)) process.exitCode = 1;
