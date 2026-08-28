import type { SchemaFingerprint } from './schema-fingerprint.js';

export type DriftStatus =
  'healthy' | 'compatible_drift' | 'breaking_drift' | 'session_failure' | 'unknown';

export interface FixtureFingerprintMetadata {
  fingerprint: string;
  requiredPaths: string[];
}

export interface CompatibilityReport {
  status: Exclude<DriftStatus, 'session_failure' | 'unknown'>;
  schemaDrift: boolean;
  missingRequiredPaths: string[];
  observedFingerprint: string;
}

export function compareCompatibility(
  observed: SchemaFingerprint,
  fixture: FixtureFingerprintMetadata,
): CompatibilityReport {
  const observedPaths = new Set(observed.paths);
  const missingRequiredPaths = fixture.requiredPaths.filter((path) => !observedPaths.has(path));
  const schemaDrift = observed.hash !== fixture.fingerprint;
  return {
    status:
      missingRequiredPaths.length > 0
        ? 'breaking_drift'
        : schemaDrift
          ? 'compatible_drift'
          : 'healthy',
    schemaDrift,
    missingRequiredPaths,
    observedFingerprint: observed.hash,
  };
}
