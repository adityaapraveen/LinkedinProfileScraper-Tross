import type { NextFunction, Request, Response } from 'express';

interface WindowState {
  count: number;
  resetAt: number;
}

export function rateLimitMiddleware(maxRequests: number, windowMs: number) {
  const clients = new Map<string, WindowState>();

  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = request.ip ?? 'unknown';
    const existing = clients.get(key);
    const state =
      !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
    state.count += 1;
    clients.set(key, state);

    response.setHeader('RateLimit-Limit', maxRequests);
    response.setHeader('RateLimit-Remaining', Math.max(0, maxRequests - state.count));
    response.setHeader('RateLimit-Reset', Math.ceil(state.resetAt / 1000));

    if (state.count > maxRequests) {
      response.status(429).json({
        error: { code: 'RATE_LIMITED', message: 'Public API rate limit exceeded' },
      });
      return;
    }
    next();
  };
}
