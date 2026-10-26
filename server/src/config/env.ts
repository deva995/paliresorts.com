import { z } from 'zod';

const booleanFlagSchema = z
  .union([z.boolean(), z.string()])
  .refine(
    (val) => typeof val === 'boolean' || /^(true|false)$/i.test(val),
    { message: 'Must be "true" or "false"' }
  )
  .transform((val) => (typeof val === 'boolean' ? val : val.toLowerCase() === 'true'))
  .default(false);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().default(8080),
  API_PREFIX: z.string().default('/api/v1'),
  TZ: z.string().default('UTC'),

  // Allowed CORS Origins (comma-separated URLs)
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),

  // PostgreSQL on Neon or local embedded PGlite
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL connection URL'),
  USE_EMBEDDED_DB: booleanFlagSchema,
  CLOUD_RUN_MAX_INSTANCES: z.coerce.number().int().positive().default(10),
  DB_POOL_MAX: z.coerce.number().int().positive().default(1),
  DB_POOL_MIN: z.coerce.number().int().nonnegative().default(0),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(120),

  // Documentation exposure control
  DOCS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  DOCS_PASSWORD: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Customer OTP Delivery mode (screen | sms)
  OTP_DELIVERY: z.enum(['screen', 'sms']).default('sms'),
  ALLOW_SCREEN_OTP: booleanFlagSchema,

  // Development authentication safety rail (default false)
  ALLOW_DEV_AUTH: booleanFlagSchema,

  // Dummy OTP configuration (default false, optional code)
  DUMMY_OTP_ENABLED: booleanFlagSchema,
  DUMMY_OTP_CODE: z.string().optional().default(''),

  // Database SSL ("true" | "false", optional)
  DB_SSL: z
    .union([z.boolean(), z.string()])
    .refine(
      (val) => typeof val === 'boolean' || /^(true|false)$/i.test(val),
      { message: 'Must be "true" or "false"' }
    )
    .transform((val) => (typeof val === 'boolean' ? val : val.toLowerCase() === 'true'))
    .optional(),

  // Database SSL verification
  DB_SSL_ALLOW_UNVERIFIED: booleanFlagSchema,
  DB_SSL_CA: z.string().optional(),

  DB_SSL_REJECT_UNAUTHORIZED: z
    .union([z.boolean(), z.string()])
    .transform((val) => val !== false && val !== 'false')
    .default(true)
}).refine(
  (data) => {
    // In production, if docs are enabled, a password must be provided
    if (data.NODE_ENV === 'production' && data.DOCS_ENABLED && !data.DOCS_PASSWORD) {
      return false;
    }
    return true;
  },
  {
    message: 'DOCS_PASSWORD is required in production when DOCS_ENABLED is true',
    path: ['DOCS_PASSWORD']
  }
).refine(
  (data) => {
    // In production, ALLOW_DEV_AUTH must never be enabled
    if (data.NODE_ENV === 'production' && data.ALLOW_DEV_AUTH) {
      return false;
    }
    return true;
  },
  {
    message: 'ALLOW_DEV_AUTH must not be enabled when NODE_ENV is production',
    path: ['ALLOW_DEV_AUTH']
  }
).refine(
  (data) => {
    // Production must never disclose an OTP through an API response.
    if (data.NODE_ENV === 'production' && data.OTP_DELIVERY === 'screen') {
      return false;
    }
    return true;
  },
  {
    message: 'Screen OTP delivery is prohibited in production',
    path: ['ALLOW_SCREEN_OTP']
  }
).refine(
  (data) => {
    // When DUMMY_OTP_ENABLED is true, DUMMY_OTP_CODE must be exactly 6 digits, not all the same digit, and not 123456, 000000 or 654321
    if (data.DUMMY_OTP_ENABLED) {
      const code = data.DUMMY_OTP_CODE ? data.DUMMY_OTP_CODE.trim() : '';
      const isSixDigits = /^\d{6}$/.test(code);
      const isAllSameDigit = /^(\d)\1{5}$/.test(code);
      const isBannedSequence = code === '123456' || code === '000000' || code === '654321';

      if (!isSixDigits || isAllSameDigit || isBannedSequence) {
        return false;
      }
    }
    return true;
  },
  {
    message: 'When DUMMY_OTP_ENABLED is true, DUMMY_OTP_CODE must be exactly 6 digits, not all the same digit, and not 123456, 000000 or 654321',
    path: ['DUMMY_OTP_CODE']
  }
).refine(
  (data) => {
    // In production, DUMMY_OTP_ENABLED must never be enabled
    if (data.NODE_ENV === 'production' && data.DUMMY_OTP_ENABLED) {
      return false;
    }
    return true;
  },
  {
    message: 'DUMMY_OTP_ENABLED must not be enabled when NODE_ENV is production',
    path: ['DUMMY_OTP_ENABLED']
  }
).refine(
  (data) => {
    // In production, database SSL certificates must always be verified
    if (data.NODE_ENV === 'production' && (data.DB_SSL_ALLOW_UNVERIFIED || !data.DB_SSL_REJECT_UNAUTHORIZED)) {
      return false;
    }
    return true;
  },
  {
    message: 'Database SSL certificate verification cannot be disabled in production',
    path: ['DB_SSL_ALLOW_UNVERIFIED']
  }
);

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig | null = null;

export function getEnv(customEnv?: Record<string, string | undefined>): EnvConfig {
  if (parsedEnv && !customEnv) {
    return parsedEnv;
  }
  const source = customEnv || process.env;
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const errorDetails = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`[Configuration Error] Invalid environment configuration: ${errorDetails}`);
  }
  if (!customEnv) {
    parsedEnv = result.data;
  }
  return result.data;
}

export function resetEnvCache(): void {
  parsedEnv = null;
}

export function getConfig(): EnvConfig {
  return getEnv();
}

