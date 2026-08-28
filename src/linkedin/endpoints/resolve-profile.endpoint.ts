import { unsupportedManifest, type EndpointManifest } from './endpoint-manifest.js';

export const resolveProfileEndpoint: EndpointManifest = unsupportedManifest(
  'resolve-profile.v1',
  'A sanitized captured profile-resolution request and response are required',
);
