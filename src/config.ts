import { z } from 'zod';

const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    PUBLIC_API_KEY: z.string().min(16),
    LINKEDIN_COOKIE: optionalSecret,
    LINKEDIN_CSRF_TOKEN: optionalSecret,
    LINKEDIN_USER_AGENT: optionalSecret,
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(8000),
    REQUEST_DEADLINE_MS: z.coerce.number().int().min(2000).max(60_000).default(20_000),
    UPSTREAM_CONCURRENCY: z.coerce.number().int().min(1).max(3).default(2),
    SECTION_CACHE_TTL_SECONDS: z.coerce.number().int().min(60).default(21_600),
    PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(60),
    PUBLIC_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((value, context) => {
    const sessionFields = [
      value.LINKEDIN_COOKIE,
      value.LINKEDIN_CSRF_TOKEN,
      value.LINKEDIN_USER_AGENT,
    ];
    const configured = sessionFields.filter(Boolean).length;
    if (configured !== 0 && configured !== sessionFields.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'LINKEDIN_COOKIE, LINKEDIN_CSRF_TOKEN, and LINKEDIN_USER_AGENT must be supplied together',
        path: ['LINKEDIN_COOKIE'],
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(environment);
}

export function hasLinkedInSession(config: AppConfig): boolean {
  return Boolean(
    config.LINKEDIN_COOKIE && config.LINKEDIN_CSRF_TOKEN && config.LINKEDIN_USER_AGENT,
  );
}
