export const errorCodes = [
  'INVALID_PROFILE_URL',
  'UNSUPPORTED_PROFILE_URL',
  'PROFILE_NOT_FOUND',
  'SESSION_UNAVAILABLE',
  'SESSION_CHALLENGE',
  'UPSTREAM_RATE_LIMITED',
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_UNAVAILABLE',
  'UPSTREAM_REJECTED',
  'UPSTREAM_SCHEMA_CHANGED',
  'SECTION_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'DomainError';
  }
}

const httpStatuses: Record<ErrorCode, number> = {
  INVALID_PROFILE_URL: 400,
  UNSUPPORTED_PROFILE_URL: 422,
  PROFILE_NOT_FOUND: 404,
  SESSION_UNAVAILABLE: 503,
  SESSION_CHALLENGE: 503,
  UPSTREAM_RATE_LIMITED: 503,
  UPSTREAM_TIMEOUT: 503,
  UPSTREAM_UNAVAILABLE: 503,
  UPSTREAM_REJECTED: 502,
  UPSTREAM_SCHEMA_CHANGED: 502,
  SECTION_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export function errorHttpStatus(code: ErrorCode): number {
  return httpStatuses[code];
}
