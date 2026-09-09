import Joi from 'joi';

export type EnvironmentVariables = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
  AUTH_OTP_SECRET: string;
  AUTH_OTP_TTL_MINUTES: number;
  AUTH_SESSION_DAYS: number;
  AUTH_COOKIE_SECURE: boolean;
  OTP_DELIVERY_MODE: 'preview' | 'disabled';
};

const nodeEnvironment = process.env.NODE_ENV ?? 'development';

export const environmentFilePaths = [`.env.${nodeEnvironment}`, '.env'];

export const environmentValidationSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(4002),
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:3002'),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  AUTH_OTP_SECRET: Joi.string()
    .min(32)
    .default('bahar-almas-development-secret-change-me'),
  AUTH_OTP_TTL_MINUTES: Joi.number().integer().min(2).max(15).default(5),
  AUTH_SESSION_DAYS: Joi.number().integer().min(1).max(30).default(7),
  AUTH_COOKIE_SECURE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(nodeEnvironment === 'production'),
  OTP_DELIVERY_MODE: Joi.string()
    .valid('preview', 'disabled')
    .default('preview'),
});
