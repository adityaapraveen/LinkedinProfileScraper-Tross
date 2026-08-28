import { describe, expect, it } from 'vitest';
import { compareCompatibility } from '../../src/linkedin/diagnostics/compatibility-report.js';
import { schemaFingerprint } from '../../src/linkedin/diagnostics/schema-fingerprint.js';

describe('schema fingerprints', () => {
  it('is stable across personal values and object key order', () => {
    const first = { name: 'Synthetic Alpha', count: 1, nested: { active: true } };
    const second = { nested: { active: false }, count: 99, name: 'Synthetic Beta' };
    expect(schemaFingerprint(first).hash).toBe(schemaFingerprint(second).hash);
  });

  it('uses deterministic paths without array indexes', () => {
    const fingerprint = schemaFingerprint({ included: [{ urn: 'one' }, { urn: 'two' }] });
    expect(fingerprint.paths).toContain('$.included[]:object');
    expect(fingerprint.paths).toContain('$.included[].urn:string');
    expect(fingerprint.paths.every((path) => !path.includes('[0]'))).toBe(true);
  });

  it('classifies added optional structure as compatible drift', () => {
    const baseline = schemaFingerprint({ data: { required: 'value' } });
    const observed = schemaFingerprint({ data: { required: 'changed', optional: 42 } });
    expect(
      compareCompatibility(observed, {
        fingerprint: baseline.hash,
        requiredPaths: ['$.data:object', '$.data.required:string'],
      }),
    ).toMatchObject({ status: 'compatible_drift', schemaDrift: true });
  });

  it('classifies missing or changed required paths as breaking drift', () => {
    const baseline = schemaFingerprint({ data: { required: 'value' } });
    const observed = schemaFingerprint({ data: { required: 42 } });
    expect(
      compareCompatibility(observed, {
        fingerprint: baseline.hash,
        requiredPaths: ['$.data.required:string'],
      }),
    ).toMatchObject({
      status: 'breaking_drift',
      missingRequiredPaths: ['$.data.required:string'],
    });
  });
});
