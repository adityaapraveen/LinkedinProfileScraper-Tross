import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import {
  requireConfigured,
  unsupportedManifest,
} from '../../src/linkedin/endpoints/endpoint-manifest.js';
import { identityEndpoint } from '../../src/linkedin/endpoints/identity.endpoint.js';
import { resolveProfileEndpoint } from '../../src/linkedin/endpoints/resolve-profile.endpoint.js';

describe('endpoint manifests', () => {
  it('represent unavailable captures without invented paths', () => {
    expect(resolveProfileEndpoint).toMatchObject({ support: 'unsupported', path: null });
    expect(identityEndpoint).toMatchObject({ support: 'unsupported', path: null });
  });

  it('fails safely before issuing a request', () => {
    expect(() => requireConfigured(identityEndpoint)).toThrow(DomainError);
    expect(() => requireConfigured(identityEndpoint)).toThrow(/identity.v1 is not configured/);
  });

  it('creates explicit unsupported boundaries', () => {
    expect(unsupportedManifest('test.v1', 'capture required')).toEqual({
      support: 'unsupported',
      id: 'test.v1',
      version: 1,
      path: null,
      parserVersion: null,
      reason: 'capture required',
    });
  });
});
