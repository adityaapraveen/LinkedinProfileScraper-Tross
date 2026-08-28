import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

function keysEqual(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

export function apiKeyMiddleware(expectedApiKey: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const candidate = request.header('x-api-key');
    if (!candidate || !keysEqual(candidate, expectedApiKey)) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } });
      return;
    }
    next();
  };
}
