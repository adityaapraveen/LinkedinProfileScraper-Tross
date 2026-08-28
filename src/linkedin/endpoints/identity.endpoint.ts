import { unsupportedManifest, type EndpointManifest } from './endpoint-manifest.js';

export const identityEndpoint: EndpointManifest = unsupportedManifest(
  'identity.v1',
  'A sanitized captured identity request and response are required',
);
