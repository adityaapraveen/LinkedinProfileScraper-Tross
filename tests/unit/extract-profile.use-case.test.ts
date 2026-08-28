import { describe, expect, it, vi } from 'vitest';
import { profileRequestSchema } from '../../src/api/schemas/profile-request.schema.js';
import { ExtractProfileUseCase } from '../../src/application/extract-profile.use-case.js';
import { DomainError } from '../../src/domain/errors.js';
import { MemoryCache } from '../../src/infrastructure/cache/memory-cache.js';

const context = {
  slug: 'sample-profile',
  canonicalUrl: 'https://www.linkedin.com/in/sample-profile/',
  profileUrn: 'urn:test:profile:sample',
  memberUrn: null,
};

const identity = {
  name: 'Sample Person',
  firstName: 'Sample',
  lastName: 'Person',
  headline: null,
  location: null,
  about: null,
  images: { profile: null, background: null },
};

function request(sections: Array<'identity' | 'skills'> = ['identity', 'skills']) {
  return profileRequestSchema.parse({
    url: context.canonicalUrl,
    sections,
    freshness: 'prefer-cache',
  });
}

describe('ExtractProfileUseCase', () => {
  it('returns successful sections when an independent section fails', async () => {
    const useCase = new ExtractProfileUseCase({
      cache: new MemoryCache(),
      resolver: { resolve: vi.fn().mockResolvedValue(context) },
      operations: {
        identity: vi
          .fn()
          .mockResolvedValue({ section: 'identity', data: identity, source: 'identity.v1' }),
        skills: vi
          .fn()
          .mockRejectedValue(new DomainError('UPSTREAM_SCHEMA_CHANGED', 'fixture mismatch')),
      },
      cacheTtlSeconds: 3600,
      concurrency: 2,
      deadlineMs: 1000,
    });

    const result = await useCase.execute(request());
    expect(result.profile.identity).toEqual(identity);
    expect(result.profile.skills).toEqual([]);
    expect(result.meta.partial).toBe(true);
    expect(result.meta.sections).toMatchObject({
      identity: { status: 'success', source: 'identity.v1' },
      skills: { status: 'failed', error: 'UPSTREAM_SCHEMA_CHANGED' },
    });
  });

  it('serves successful sections from cache without resolving again', async () => {
    const resolver = { resolve: vi.fn().mockResolvedValue(context) };
    const identityOperation = vi
      .fn()
      .mockResolvedValue({ section: 'identity', data: identity, source: 'identity.v1' });
    const useCase = new ExtractProfileUseCase({
      cache: new MemoryCache(),
      resolver,
      operations: { identity: identityOperation },
      cacheTtlSeconds: 3600,
      concurrency: 2,
      deadlineMs: 1000,
    });

    await useCase.execute(request(['identity']));
    const cached = await useCase.execute(request(['identity']));

    expect(cached.meta.cached).toBe(true);
    expect(cached.meta.sections.identity?.source).toBe('cache.v1');
    expect(resolver.resolve).toHaveBeenCalledTimes(1);
    expect(identityOperation).toHaveBeenCalledTimes(1);
  });

  it('fails the request when resolution fails before any section succeeds', async () => {
    const useCase = new ExtractProfileUseCase({
      cache: new MemoryCache(),
      resolver: {
        resolve: vi.fn().mockRejectedValue(new DomainError('SESSION_UNAVAILABLE', 'unavailable')),
      },
      operations: {},
      cacheTtlSeconds: 3600,
      concurrency: 2,
      deadlineMs: 1000,
    });

    await expect(useCase.execute(request(['identity']))).rejects.toMatchObject({
      code: 'SESSION_UNAVAILABLE',
    });
  });

  it('marks unconfigured section operations unavailable', async () => {
    const useCase = new ExtractProfileUseCase({
      cache: new MemoryCache(),
      resolver: { resolve: vi.fn().mockResolvedValue(context) },
      operations: {},
      cacheTtlSeconds: 3600,
      concurrency: 2,
      deadlineMs: 1000,
    });

    const result = await useCase.execute(request(['skills']));
    expect(result.meta.sections.skills).toMatchObject({
      status: 'failed',
      error: 'SECTION_UNAVAILABLE',
    });
  });
});
