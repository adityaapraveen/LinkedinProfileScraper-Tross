import type { AppDependencies } from './app.js';
import { ExtractProfileUseCase } from './application/extract-profile.use-case.js';
import type { AppConfig } from './config.js';
import { DomainError } from './domain/errors.js';
import { profileSections } from './domain/profile.js';
import { MemoryCache } from './infrastructure/cache/memory-cache.js';
import { LinkedInClient } from './linkedin/client/linkedin-client.js';
import { SessionHealth } from './linkedin/client/session-health.js';
import { DriftMonitor } from './linkedin/diagnostics/drift-monitor.js';
import { resolveProfile } from './linkedin/operations/resolve-profile.js';

export function createDependencies(config: AppConfig): AppDependencies {
  const client = LinkedInClient.fromConfig(config);
  const sessionHealth = client?.sessionHealth ?? new SessionHealth(false);
  const driftMonitor = new DriftMonitor();
  const profileExtractor = new ExtractProfileUseCase({
    cache: new MemoryCache(),
    resolver: {
      resolve: (slug, canonicalUrl) => {
        if (!client) {
          return Promise.reject(
            new DomainError('SESSION_UNAVAILABLE', 'The upstream session is not configured'),
          );
        }
        return resolveProfile(client, slug, canonicalUrl);
      },
    },
    operations: {},
    cacheTtlSeconds: config.SECTION_CACHE_TTL_SECONDS,
    concurrency: config.UPSTREAM_CONCURRENCY,
    deadlineMs: config.REQUEST_DEADLINE_MS,
  });

  return {
    profileExtractor,
    upstreamHealthReader: {
      getHealth: () => ({
        session: sessionHealth.snapshot(),
        operations: driftMonitor.snapshot(profileSections),
      }),
    },
  };
}
