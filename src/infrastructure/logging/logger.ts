import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers.x-api-key',
      'headers.cookie',
      'headers.authorization',
      'headers.x-api-key',
      'cookie',
      'csrfToken',
      'apiKey',
      'profile',
      'responseBody',
    ],
    censor: '[REDACTED]',
  },
});
