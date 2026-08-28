import { unsupportedManifest, type EndpointManifest } from './endpoint-manifest.js';

export const skillsEndpoint: EndpointManifest = unsupportedManifest(
  'skills.v1',
  'A sanitized captured skills request and response are required',
);
