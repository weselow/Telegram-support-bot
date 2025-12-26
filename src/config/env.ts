import { config } from 'dotenv';
import { z } from 'zod';

// Load .env.local first (for local development), then .env as fallback
config({ path: '.env.local' });
config({ path: '.env' });

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  SUPPORT_GROUP_ID: z.string().min(1, 'SUPPORT_GROUP_ID is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.issues, null, 2));
  process.exit(1);
}

export const env = parsed.data;
