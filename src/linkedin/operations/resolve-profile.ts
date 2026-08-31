import type { LinkedInClient } from '../client/linkedin-client.js';
import { requireConfigured, type ProfileContext } from '../endpoints/endpoint-manifest.js';
import { resolveProfileEndpoint } from '../endpoints/resolve-profile.endpoint.js';
import { parseProfileContext } from '../parsing/full-profile.parser.js';

export async function resolveProfile(
  client: LinkedInClient,
  slug: string,
  canonicalUrl: string,
): Promise<ProfileContext> {
  requireConfigured(resolveProfileEndpoint);
  const seedContext: ProfileContext = {
    slug,
    canonicalUrl,
    profileUrn: null,
    memberUrn: null,
  };
  const response = await client.execute({
    operation: resolveProfileEndpoint.id,
    path: resolveProfileEndpoint.path,
    query: resolveProfileEndpoint.buildQuery(seedContext),
    ...(resolveProfileEndpoint.headers ? { headers: resolveProfileEndpoint.headers } : {}),
  });

  return parseProfileContext(response.data, slug, canonicalUrl);
}
