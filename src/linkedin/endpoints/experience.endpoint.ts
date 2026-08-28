import { unsupportedManifest, type EndpointManifest } from './endpoint-manifest.js';

export const experienceEndpoint: EndpointManifest = unsupportedManifest(
  'experience.v1',
  'A sanitized captured experience request and response are required',
);
