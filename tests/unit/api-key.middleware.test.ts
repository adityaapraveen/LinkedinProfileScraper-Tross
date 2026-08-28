import { afterEach, describe, expect, it } from 'vitest';
import type { AppConfig } from '../../src/config.js';
import { createApp } from '../../src/app.js';

const apiKey = 'test-public-api-key';
const config = {
  NODE_ENV: 'test',
  PORT: 3000,
  PUBLIC_API_KEY: apiKey,
  UPSTREAM_TIMEOUT_MS: 8000,
  REQUEST_DEADLINE_MS: 20_000,
  UPSTREAM_CONCURRENCY: 2,
  SECTION_CACHE_TTL_SECONDS: 21_600,
  PUBLIC_RATE_LIMIT_MAX: 60,
  PUBLIC_RATE_LIMIT_WINDOW_MS: 60_000,
  LOG_LEVEL: 'silent',
} satisfies AppConfig;

const servers: Array<ReturnType<ReturnType<typeof createApp>['listen']>> = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function request(path: string, key?: string): Promise<Response> {
  const server = createApp(config).listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    headers: key ? { 'x-api-key': key } : {},
  });
}

describe('API key middleware', () => {
  it('rejects a missing key', async () => {
    expect((await request('/v1/upstream/health')).status).toBe(401);
  });

  it('rejects an invalid key', async () => {
    expect((await request('/v1/upstream/health', 'wrong-key')).status).toBe(401);
  });

  it('allows the configured key', async () => {
    expect((await request('/v1/upstream/health', apiKey)).status).toBe(200);
  });
});
