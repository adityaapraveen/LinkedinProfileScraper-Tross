import express from 'express';
import { pinoHttp } from 'pino-http';
import { createUpstreamHealthRouter } from './api/routes/health.routes.js';
import { createProfileRouter } from './api/routes/profile.routes.js';
import { apiKeyMiddleware } from './api/middleware/api-key.middleware.js';
import { errorMiddleware } from './api/middleware/error.middleware.js';
import { rateLimitMiddleware } from './api/middleware/rate-limit.middleware.js';
import type { ProfileExtractor } from './api/controllers/profile.controller.js';
import type { UpstreamHealthReader } from './api/controllers/upstream-health.controller.js';
import type { AppConfig } from './config.js';
import { DomainError } from './domain/errors.js';
import { logger } from './infrastructure/logging/logger.js';

export interface AppDependencies {
  profileExtractor: ProfileExtractor;
  upstreamHealthReader: UpstreamHealthReader;
}

const unavailableDependencies: AppDependencies = {
  profileExtractor: {
    execute: () =>
      Promise.reject(
        new DomainError(
          'SECTION_UNAVAILABLE',
          'LinkedIn endpoint manifests have not been configured',
        ),
      ),
  },
  upstreamHealthReader: {
    getHealth: () => ({
      session: { status: 'unknown', lastValidatedAt: null },
      operations: {},
    }),
  },
};

export function createApp(
  config: AppConfig,
  dependencies: AppDependencies = unavailableDependencies,
) {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const protectedApi = express.Router();
  protectedApi.use(
    rateLimitMiddleware(config.PUBLIC_RATE_LIMIT_MAX, config.PUBLIC_RATE_LIMIT_WINDOW_MS),
  );
  protectedApi.use(apiKeyMiddleware(config.PUBLIC_API_KEY));
  protectedApi.use('/profiles', createProfileRouter(dependencies.profileExtractor));
  protectedApi.use(
    '/upstream/health',
    createUpstreamHealthRouter(dependencies.upstreamHealthReader),
  );
  app.use('/v1', protectedApi);

  app.use(errorMiddleware);
  return app;
}
