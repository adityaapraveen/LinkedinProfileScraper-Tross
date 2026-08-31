import type { EndpointManifest } from './endpoint-manifest.js';

export const resolveProfileEndpoint: EndpointManifest = {
  support: 'configured',
  id: 'full-profile.v1',
  version: 1,
  path: '/voyager/api/identity/dash/profiles',
  parserVersion: 'full-profile.v1',
  headers: {
    accept: 'application/vnd.linkedin.normalized+json+2.1',
    'x-li-lang': 'en_US',
    'x-restli-protocol-version': '2.0.0',
  },
  buildQuery: (context) =>
    new URLSearchParams({
      q: 'memberIdentity',
      memberIdentity: context.slug,
      decorationId: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-101',
    }),
};
