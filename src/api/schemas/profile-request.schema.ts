import { z } from 'zod';
import { DomainError } from '../../domain/errors.js';
import { profileSections } from '../../domain/profile.js';

const allowedHosts = new Set(['linkedin.com', 'www.linkedin.com']);
const slugPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,98}[A-Za-z0-9])?$/;

export interface ParsedProfileUrl {
  slug: string;
  canonicalUrl: string;
}

export function parseLinkedInProfileUrl(input: string): ParsedProfileUrl {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new DomainError('INVALID_PROFILE_URL', 'The profile URL is not a valid URL');
  }

  if (url.protocol !== 'https:') {
    throw new DomainError('INVALID_PROFILE_URL', 'The profile URL must use HTTPS');
  }
  if (!allowedHosts.has(url.hostname.toLowerCase())) {
    throw new DomainError('UNSUPPORTED_PROFILE_URL', 'The hostname is not supported');
  }
  if (url.port || url.username || url.password || url.search || url.hash) {
    throw new DomainError('INVALID_PROFILE_URL', 'The profile URL contains unsupported components');
  }
  if (url.pathname.includes('%') || url.pathname.includes('\\')) {
    throw new DomainError('INVALID_PROFILE_URL', 'The profile URL path is not canonical');
  }

  const match = /^\/in\/([^/]+)\/?$/.exec(url.pathname);
  const slug = match?.[1];
  if (!slug || !slugPattern.test(slug)) {
    throw new DomainError('UNSUPPORTED_PROFILE_URL', 'Expected a LinkedIn /in/{slug} profile URL');
  }

  return { slug, canonicalUrl: `https://www.linkedin.com/in/${slug}/` };
}

export const profileRequestSchema = z
  .object({
    url: z.string().min(1).max(500),
    sections: z.array(z.enum(profileSections)).min(1).max(profileSections.length).optional(),
    freshness: z.enum(['prefer-cache', 'live']).default('prefer-cache'),
  })
  .strict()
  .transform((request) => ({
    ...request,
    sections: [...new Set(request.sections ?? profileSections)],
    parsedUrl: parseLinkedInProfileUrl(request.url),
  }));

export type ProfileRequest = z.infer<typeof profileRequestSchema>;
