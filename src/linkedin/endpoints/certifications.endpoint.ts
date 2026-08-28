import { unsupportedManifest, type EndpointManifest } from './endpoint-manifest.js';

export const certificationsEndpoint: EndpointManifest = unsupportedManifest(
  'certifications.v1',
  'A sanitized captured certifications request and response are required',
);
