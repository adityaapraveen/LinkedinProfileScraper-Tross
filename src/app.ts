import express from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './infrastructure/logging/logger.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
