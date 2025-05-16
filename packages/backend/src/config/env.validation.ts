import { z } from 'zod';

export const validationSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  BASE_URL: z.string().url(),

  // Auth
  JWT_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  LINKEDIN_CLIENT_ID: z.string().min(1),
  LINKEDIN_CLIENT_SECRET: z.string().min(1),
  FRONTEND_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().min(1),

  // PostgreSQL
  DATABASE_URL: z.string().min(1),

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/logging'),
  MONGODB_USER: z.string().optional(),
  MONGODB_PASSWORD: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string(),
  FROM_ADDRESS: z.string().email(),
  EMERGENCY_ADMIN_EMAILS: z.string(), // not .email() because it's a comma separated list of emails

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIR: z.string().default('logs'),
  LOGGING_MONGO_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  LOGGING_FILE_ENABLED: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().default(true),
  ),
  LOGGING_DEFAULT_RETENTION_DAYS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('30'),
});

// The type is automatically inferred from the schema
export type EnvironmentVariables = z.infer<typeof validationSchema>;
