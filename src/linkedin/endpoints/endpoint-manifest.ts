import { DomainError } from '../../domain/errors.js';

export interface ProfileContext {
  slug: string;
  canonicalUrl: string;
  profileUrn: string | null;
  memberUrn: string | null;
}

export interface ConfiguredEndpointManifest {
  support: 'configured';
  id: string;
  version: number;
  path: string;
  parserVersion: string;
  buildQuery(context: ProfileContext): URLSearchParams;
  headers?: Readonly<Record<string, string>>;
}

export interface UnsupportedEndpointManifest {
  support: 'unsupported';
  id: string;
  version: number;
  path: null;
  parserVersion: null;
  reason: string;
}

export type EndpointManifest = ConfiguredEndpointManifest | UnsupportedEndpointManifest;

export function unsupportedManifest(id: string, reason: string): UnsupportedEndpointManifest {
  return { support: 'unsupported', id, version: 1, path: null, parserVersion: null, reason };
}

export function requireConfigured(
  manifest: EndpointManifest,
): asserts manifest is ConfiguredEndpointManifest {
  if (manifest.support === 'unsupported') {
    throw new DomainError('SECTION_UNAVAILABLE', `${manifest.id} is not configured`);
  }
}
