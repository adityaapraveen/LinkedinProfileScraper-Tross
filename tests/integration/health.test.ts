import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const servers: Array<ReturnType<ReturnType<typeof createApp>['listen']>> = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe('GET /health', () => {
  it('returns service health without authentication', async () => {
    const server = createApp().listen(0);
    servers.push(server);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = (await response.json()) as { status: string; timestamp: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
