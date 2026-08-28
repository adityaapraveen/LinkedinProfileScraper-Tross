import { createApp } from './app.js';
import { logger } from './infrastructure/logging/logger.js';

const port = Number(process.env.PORT ?? 3000);
const app = createApp();
const server = app.listen(port, '0.0.0.0', () => {
  logger.info({ port }, 'HTTP server listening');
});

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

function shutdown(signal: string): void {
  logger.info({ signal }, 'Graceful shutdown started');
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'Graceful shutdown failed');
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
