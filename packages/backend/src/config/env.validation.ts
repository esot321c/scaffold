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
}
