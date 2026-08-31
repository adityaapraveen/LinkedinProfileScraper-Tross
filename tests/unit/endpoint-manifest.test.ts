import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import {
  requireConfigured,
  unsupportedManifest,
} from '../../src/linkedin/endpoints/endpoint-manifest.js';
import { identityEndpoint } from '../../src/linkedin/endpoints/identity.endpoint.js';
import { resolveProfileEndpoint } from '../../src/linkedin/endpoints/resolve-profile.endpoint.js';

describe('endpoint manifests', () => {
  it('configures the verified full-profile endpoint for profile resolution and sections', () => {
    expect(resolveProfileEndpoint).toMatchObject({
      support: 'configured',
      id: 'full-profile.v1',
      path: '/voyager/api/identity/dash/profiles',
      parserVersion: 'full-profile.v1',
    });
    if (resolveProfileEndpoint.support === 'configured') {
      expect(
        resolveProfileEndpoint.buildQuery({
          slug: 'synthetic-person',
          canonicalUrl: 'https://www.linkedin.com/in/synthetic-person/',
          profileUrn: null,
          memberUrn: null,
        }),
      ).toEqual(
        new URLSearchParams({
          q: 'memberIdentity',
          memberIdentity: 'synthetic-person',
          decorationId:
            'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-101',
        }),
      );
    }
    expect(identityEndpoint).toBe(resolveProfileEndpoint);
  });

  it('accepts the verified manifest', () => {
    expect(() => requireConfigured(identityEndpoint)).not.toThrow();
  });

  it('creates explicit unsupported boundaries', () => {
    const manifest = unsupportedManifest('test.v1', 'capture required');
    expect(manifest).toEqual({
      support: 'unsupported',
      id: 'test.v1',
      version: 1,
      path: null,
      parserVersion: null,
      reason: 'capture required',
    });
    expect(() => requireConfigured(manifest)).toThrow(DomainError);
  });
});
