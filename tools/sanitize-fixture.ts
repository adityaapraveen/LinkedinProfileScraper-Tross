import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  sanitizeFixture,
  type FixtureSanitizationPolicy,
} from '../src/linkedin/diagnostics/fixture-sanitizer.js';

const [inputArgument, outputArgument, policyArgument] = process.argv.slice(2);
if (!inputArgument || !outputArgument || !policyArgument) {
  console.error(
    'Usage: npm run protocol:sanitize -- <raw-input.json> <sanitized-output.json> <policy.json>',
  );
  process.exit(1);
}

const inputPath = resolve(inputArgument);
const outputPath = resolve(outputArgument);
const policyPath = resolve(policyArgument);
if (inputPath === outputPath) {
  throw new Error('Refusing to overwrite the raw input fixture');
}

const input = JSON.parse(await readFile(inputPath, 'utf8')) as unknown;
const policy = JSON.parse(await readFile(policyPath, 'utf8')) as FixtureSanitizationPolicy;
const output = sanitizeFixture(input, policy);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, { flag: 'wx' });
console.log(`Wrote sanitized fixture to ${outputPath}`);
console.log('Manual privacy review is still required before adding the file to Git.');
