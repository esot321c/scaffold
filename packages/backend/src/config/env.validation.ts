import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  BASE_URL: Joi.string().required(),

  // Auth
  JWT_SECRET: Joi.string().required(),

  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),

  LINKEDIN_CLIENT_ID: Joi.string().required(),
  LINKEDIN_CLIENT_SECRET: Joi.string().required(),

  FRONTEND_URL: Joi.string().required(),

  // Redis
  REDIS_URL: Joi.string().required(),

  // PostgreSQL
  DATABASE_URL: Joi.string().required(),

  // MongoDB
  MONGODB_URI: Joi.string().default('mongodb://localhost:27017/logging'),
  MONGODB_USER: Joi.string().optional(),
  MONGODB_PASSWORD: Joi.string().optional(),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
  LOG_DIR: Joi.string().default('logs'),
  LOGGING_MONGO_ENABLED: Joi.boolean().default(true),
  LOGGING_FILE_ENABLED: Joi.boolean().default(true),
  LOGGING_DEFAULT_RETENTION_DAYS: Joi.number().default(30),
});

export interface EnvironmentVariables {
  NODE_ENV: string;
  BASE_URL: string;
  PORT: number;

  // Auth
  JWT_SECRET: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;

  LINKEDIN_CLIENT_ID: string;
  LINKEDIN_CLIENT_SECRET: string;

  FRONTEND_URL: string;

  // Redis
  REDIS_URL: string;

  // PostgreSQL
  DATABASE_URL: string;

  // MongoDB
  MONGODB_URI: string;
  MONGODB_USER?: string;
  MONGODB_PASSWORD?: string;

  // Logging
  LOG_LEVEL: string;
  LOG_DIR: string;
  LOGGING_MONGO_ENABLED: boolean;
  LOGGING_FILE_ENABLED: boolean;
  LOGGING_DEFAULT_RETENTION_DAYS: number;
}
