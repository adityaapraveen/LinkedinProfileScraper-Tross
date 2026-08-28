import { unsupportedManifest, type EndpointManifest } from './endpoint-manifest.js';

export const languagesEndpoint: EndpointManifest = unsupportedManifest(
  'languages.v1',
  'A sanitized captured languages request and response are required',
);
