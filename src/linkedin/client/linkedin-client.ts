import { setTimeout as delay } from 'node:timers/promises';
import { request as undiciRequest } from 'undici';
import { z } from 'zod';
import type { AppConfig } from '../../config.js';
import { DomainError } from '../../domain/errors.js';
import type { LinkedInRequest, LinkedInResponse } from './linkedin-request.js';
import { SessionHealth } from './session-health.js';

const LINKEDIN_ORIGIN = 'https://www.linkedin.com';
const jsonEnvelopeSchema = z.union([z.record(z.unknown()), z.array(z.unknown())]);

interface TransportResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: { text(): Promise<string> };
}

export type LinkedInTransport = (
  url: URL,
  options: {
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    signal: AbortSignal;
  },
) => Promise<TransportResponse>;

const defaultTransport: LinkedInTransport = async (url, options) => {
  const response = await undiciRequest(url, options);
  return response;
};

export interface LinkedInClientOptions {
  cookie: string;
  csrfToken: string;
  userAgent: string;
  timeoutMs: number;
  transport?: LinkedInTransport;
  sessionHealth?: SessionHealth;
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function looksLikeLoginOrChallenge(body: string): boolean {
  const sample = body.slice(0, 4096).toLowerCase();
  return (
    sample.includes('<html') &&
    (sample.includes('login') || sample.includes('checkpoint') || sample.includes('challenge'))
  );
}

function isRetryable(error: unknown): boolean {
  return (
    error instanceof DomainError &&
    (error.code === 'UPSTREAM_TIMEOUT' || error.code === 'UPSTREAM_UNAVAILABLE')
  );
}

export class LinkedInClient {
  readonly sessionHealth: SessionHealth;
  private readonly transport: LinkedInTransport;

  constructor(private readonly options: LinkedInClientOptions) {
    this.transport = options.transport ?? defaultTransport;
    this.sessionHealth = options.sessionHealth ?? new SessionHealth(true);
  }

  static fromConfig(config: AppConfig, sessionHealth?: SessionHealth): LinkedInClient | null {
    if (!config.LINKEDIN_COOKIE || !config.LINKEDIN_CSRF_TOKEN || !config.LINKEDIN_USER_AGENT) {
      return null;
    }
    return new LinkedInClient({
      cookie: config.LINKEDIN_COOKIE,
      csrfToken: config.LINKEDIN_CSRF_TOKEN,
      userAgent: config.LINKEDIN_USER_AGENT,
      timeoutMs: config.UPSTREAM_TIMEOUT_MS,
      ...(sessionHealth ? { sessionHealth } : {}),
    });
  }

  async execute(request: LinkedInRequest): Promise<LinkedInResponse> {
    this.sessionHealth.assertAvailable();
    this.validatePath(request.path);

    for (let attempt = 0; attempt <= 1; attempt += 1) {
      try {
        return await this.executeOnce(request);
      } catch (error) {
        if (attempt === 1 || !isRetryable(error)) throw error;
        await delay(100 * 2 ** attempt + Math.floor(Math.random() * 50));
      }
    }
    throw new DomainError('INTERNAL_ERROR', 'Unreachable retry state');
  }

  private validatePath(path: string): void {
    if (!path.startsWith('/voyager/api/') || path.includes('://') || path.includes('..')) {
      throw new DomainError('INTERNAL_ERROR', 'Invalid internally configured upstream path');
    }
  }

  private async executeOnce(request: LinkedInRequest): Promise<LinkedInResponse> {
    const url = new URL(request.path, LINKEDIN_ORIGIN);
    if (request.query) url.search = request.query.toString();
    const signal = AbortSignal.timeout(this.options.timeoutMs);

    let response: TransportResponse;
    try {
      response = await this.transport(url, {
        method: request.method ?? 'GET',
        headers: {
          accept: 'application/json',
          cookie: this.options.cookie,
          'csrf-token': this.options.csrfToken,
          'user-agent': this.options.userAgent,
          ...request.headers,
        },
        ...(request.body === undefined ? {} : { body: request.body }),
        signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new DomainError('UPSTREAM_TIMEOUT', 'The upstream request timed out', {
          cause: error,
        });
      }
      throw new DomainError('UPSTREAM_UNAVAILABLE', 'The upstream request failed', {
        cause: error,
      });
    }

    const contentType = headerValue(response.headers['content-type']).toLowerCase();
    const body = await response.body.text();
    this.classifyStatus(response.statusCode, contentType, body);

    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch (error) {
      throw new DomainError('UPSTREAM_REJECTED', 'The upstream returned invalid JSON', {
        cause: error,
      });
    }

    const envelope = jsonEnvelopeSchema.safeParse(parsed);
    if (!envelope.success) {
      throw new DomainError('UPSTREAM_SCHEMA_CHANGED', 'The upstream JSON envelope changed');
    }
    this.sessionHealth.markHealthy();
    return { statusCode: response.statusCode, data: envelope.data, contentType };
  }

  private classifyStatus(statusCode: number, contentType: string, body: string): void {
    const challenge = looksLikeLoginOrChallenge(body);
    if (statusCode === 401 || statusCode === 403 || challenge) {
      this.sessionHealth.markAuthenticationFailure(challenge);
      throw new DomainError(
        challenge ? 'SESSION_CHALLENGE' : 'SESSION_UNAVAILABLE',
        challenge
          ? 'The upstream session requires a challenge'
          : 'The upstream session was rejected',
      );
    }
    if (statusCode === 404) throw new DomainError('PROFILE_NOT_FOUND', 'The profile was not found');
    if (statusCode === 429)
      throw new DomainError('UPSTREAM_RATE_LIMITED', 'The upstream rate limit was reached');
    if (statusCode === 502 || statusCode === 503)
      throw new DomainError('UPSTREAM_UNAVAILABLE', 'The upstream is temporarily unavailable');
    if (statusCode < 200 || statusCode >= 300)
      throw new DomainError('UPSTREAM_REJECTED', 'The upstream rejected the request');
    if (!contentType.includes('application/json') && !contentType.includes('+json')) {
      throw new DomainError('UPSTREAM_REJECTED', 'The upstream returned a non-JSON response');
    }
  }
}
