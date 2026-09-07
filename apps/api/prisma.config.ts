import { config as loadEnvironment } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const nodeEnvironment = process.env.NODE_ENV ?? 'development';

loadEnvironment({ path: [`.env.${nodeEnvironment}`, '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
