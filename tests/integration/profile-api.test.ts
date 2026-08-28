import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type AppDependencies } from '../../src/app.js';
import { loadConfig } from '../../src/config.js';
import { DomainError } from '../../src/domain/errors.js';

const apiKey = 'integration-api-key';
const config = loadConfig({ NODE_ENV: 'test', PUBLIC_API_KEY: apiKey });
const servers: Array<ReturnType<ReturnType<typeof createApp>['listen']>> = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

async function post(execute: AppDependencies['profileExtractor']['execute'], body: string) {
  const app = createApp(config, {
    profileExtractor: { execute },
    upstreamHealthReader: { getHealth: () => ({}) },
  });
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP listener');
  return fetch(`http://127.0.0.1:${address.port}/v1/profiles/extract`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body,
  });
}

describe('POST /v1/profiles/extract', () => {
  it('does not expose internal domain error messages', async () => {
    const response = await post(
      () =>
        Promise.reject(new DomainError('UPSTREAM_REJECTED', 'private upstream response contents')),
      JSON.stringify({ url: 'https://www.linkedin.com/in/synthetic-profile/' }),
    );
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(text).toContain('UPSTREAM_REJECTED');
    expect(text).not.toContain('private upstream response contents');
  });

  it('sanitizes unexpected errors', async () => {
    const response = await post(
      () => Promise.reject(new Error('sensitive implementation detail')),
      JSON.stringify({ url: 'https://www.linkedin.com/in/synthetic-profile/' }),
    );
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).toContain('INTERNAL_ERROR');
    expect(text).not.toContain('sensitive implementation detail');
  });

  it('rejects malformed JSON as an invalid request', async () => {
    const response = await post(() => Promise.reject(new Error('must not execute')), '{');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'INVALID_REQUEST' },
    });
  });

  it('rejects unsafe profile URLs before calling the extractor', async () => {
    const response = await post(
      () => Promise.reject(new Error('must not execute')),
      JSON.stringify({ url: 'https://evil.example/in/synthetic-profile/' }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'UNSUPPORTED_PROFILE_URL' },
    });
  });
});
