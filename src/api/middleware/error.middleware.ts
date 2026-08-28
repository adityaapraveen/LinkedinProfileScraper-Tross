import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { DomainError, errorHttpStatus } from '../../domain/errors.js';

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

  if (error instanceof DomainError) {
    response.status(errorHttpStatus(error.code)).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }

  request.log.error({ err: error }, 'Unhandled request error');
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
  });
};
