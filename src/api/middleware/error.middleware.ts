import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { DomainError, errorHttpStatus, type ErrorCode } from '../../domain/errors.js';

const publicMessages: Record<ErrorCode, string> = {
  INVALID_PROFILE_URL: 'The profile URL is invalid',
  UNSUPPORTED_PROFILE_URL: 'The profile URL is not supported',
  PROFILE_NOT_FOUND: 'The profile was not found',
  SESSION_UNAVAILABLE: 'The upstream session is unavailable',
  SESSION_CHALLENGE: 'The upstream session requires attention',
  UPSTREAM_RATE_LIMITED: 'The upstream service is temporarily rate limited',
  UPSTREAM_TIMEOUT: 'The upstream service timed out',
  UPSTREAM_UNAVAILABLE: 'The upstream service is temporarily unavailable',
  UPSTREAM_REJECTED: 'The upstream service rejected the request',
  UPSTREAM_SCHEMA_CHANGED: 'The upstream response is not currently compatible',
  SECTION_UNAVAILABLE: 'The requested profile section is unavailable',
  INTERNAL_ERROR: 'An internal error occurred',
};

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 400
  );
}

export const errorMiddleware: ErrorRequestHandler = (error, request, response, next) => {
  void next;
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'Request validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (isJsonParseError(error)) {
    response.status(400).json({
      error: { code: 'INVALID_REQUEST', message: 'Request body must be valid JSON' },
    });
    return;
  }

  if (error instanceof DomainError) {
    response.status(errorHttpStatus(error.code)).json({
      error: { code: error.code, message: publicMessages[error.code] },
    });
    return;
  }

  request.log.error(
    { errorType: error instanceof Error ? error.name : typeof error },
    'Unhandled request error',
  );
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
  });
};
