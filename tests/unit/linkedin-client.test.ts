import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import {
  LinkedInClient,
  type LinkedInTransport,
} from '../../src/linkedin/client/linkedin-client.js';

function response(statusCode: number, contentType: string, body: string) {
  return {
    statusCode,
    headers: { 'content-type': contentType },
    body: { text: () => Promise.resolve(body) },
  };
}

function clientWith(transport: LinkedInTransport): LinkedInClient {
  return new LinkedInClient({
    cookie: 'test-cookie',
    csrfToken: 'test-csrf',
    userAgent: 'test-agent',
    timeoutMs: 1000,
    transport,
  });
}

const request = { operation: 'identity', path: '/voyager/api/configured-test-path' };

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('LinkedInClient', () => {
  it('returns validated JSON and marks the session healthy', async () => {
    const transport = vi
      .fn<LinkedInTransport>()
      .mockResolvedValue(response(200, 'application/json; charset=utf-8', '{"data":{}}'));
    const client = clientWith(transport);

    await expect(client.execute(request)).resolves.toMatchObject({ data: { data: {} } });
    expect(client.sessionHealth.snapshot().status).toBe('healthy');
  });

  it('accepts LinkedIn normalized vendor JSON media types', async () => {
    const transport = vi
      .fn<LinkedInTransport>()
      .mockResolvedValue(
        response(200, 'application/vnd.linkedin.normalized+json+2.1', '{"data":{}}'),
      );

    await expect(clientWith(transport).execute(request)).resolves.toMatchObject({
      data: { data: {} },
    });
  });

  it.each([
    [401, 'application/json', '{}', 'SESSION_UNAVAILABLE'],
    [403, 'application/json', '{}', 'SESSION_UNAVAILABLE'],
    [429, 'application/json', '{}', 'UPSTREAM_RATE_LIMITED'],
    [404, 'application/json', '{}', 'PROFILE_NOT_FOUND'],
    [500, 'application/json', '{}', 'UPSTREAM_REJECTED'],
    [200, 'text/plain', 'not json', 'UPSTREAM_REJECTED'],
  ])('classifies status %s as %s', async (status, contentType, body, code) => {
    const transport = vi
      .fn<LinkedInTransport>()
      .mockResolvedValue(response(status, contentType, body));
    await expectCode(clientWith(transport).execute(request), code);
  });

  it('detects an HTML login response and opens the circuit', async () => {
    const transport = vi
      .fn<LinkedInTransport>()
      .mockResolvedValue(response(200, 'text/html', '<html><title>LinkedIn Login</title></html>'));
    const client = clientWith(transport);

    await expectCode(client.execute(request), 'SESSION_CHALLENGE');
    await expectCode(client.execute(request), 'SESSION_UNAVAILABLE');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('retries one temporary 503 response', async () => {
    const transport = vi
      .fn<LinkedInTransport>()
      .mockResolvedValueOnce(response(503, 'application/json', '{}'))
      .mockResolvedValueOnce(response(200, 'application/json', '{}'));

    await expect(clientWith(transport).execute(request)).resolves.toMatchObject({
      statusCode: 200,
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('does not retry rate limits', async () => {
    const transport = vi
      .fn<LinkedInTransport>()
      .mockResolvedValue(response(429, 'application/json', '{}'));

    await expectCode(clientWith(transport).execute(request), 'UPSTREAM_RATE_LIMITED');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('classifies timeout exceptions and retries once', async () => {
    const transport = vi
      .fn<LinkedInTransport>()
      .mockRejectedValue(new DOMException('timed out', 'TimeoutError'));

    await expectCode(clientWith(transport).execute(request), 'UPSTREAM_TIMEOUT');
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('rejects paths outside the internal LinkedIn API boundary', async () => {
    const transport = vi.fn<LinkedInTransport>();
    const client = clientWith(transport);
    await expectCode(
      client.execute({ operation: 'unsafe', path: 'https://evil.example/path' }),
      'INTERNAL_ERROR',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('does not expose response bodies in errors', async () => {
    const secret = 'private-upstream-body';
    const transport = vi
      .fn<LinkedInTransport>()
      .mockResolvedValue(response(500, 'text/plain', secret));
    try {
      await clientWith(transport).execute(request);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
