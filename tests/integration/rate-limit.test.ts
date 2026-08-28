import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';

const apiKey = 'rate-limit-test-key';
const servers: Array<ReturnType<ReturnType<typeof createApp>['listen']>> = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe('public API rate limiting', () => {
  it('returns 429 and standard limit metadata after the configured maximum', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      PUBLIC_API_KEY: apiKey,
      PUBLIC_RATE_LIMIT_MAX: '1',
      PUBLIC_RATE_LIMIT_WINDOW_MS: '60000',
    });
    const server = createApp(config).listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
    const url = `http://127.0.0.1:${address.port}/v1/upstream/health`;
    const options = { headers: { 'x-api-key': apiKey } };

    const first = await fetch(url, options);
    const second = await fetch(url, options);

    expect(first.status).toBe(200);
    expect(first.headers.get('ratelimit-remaining')).toBe('0');
    expect(second.status).toBe(429);
    expect(second.headers.get('ratelimit-limit')).toBe('1');
    await expect(second.json()).resolves.toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
  });
});
