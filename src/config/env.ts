import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  BOT_USERNAME: z.string().min(1, 'BOT_USERNAME is required'),
  SUPPORT_GROUP_ID: z.string().min(1, 'SUPPORT_GROUP_ID is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Хеш коммита, из которого собран образ. Приезжает build-аргументом при сборке
  // (см. Dockerfile и .github/workflows/deploy.yml) и отдаётся в ответе /health,
  // чтобы выкатка дожидалась именно новой версии. При запуске из исходников
  // переменной нет, а при сборке без аргумента она пустая — в обоих случаях 'dev'.
  APP_COMMIT: z.string().min(1).catch('dev'),

  // Website integration
  HTTP_PORT: z.string().default('3000'),
  SUPPORT_DOMAIN: z.string().optional(),
  // Домены сайтов, на которых стоит виджет, через запятую (кроме SUPPORT_DOMAIN)
  ALLOWED_ORIGINS: z.string().optional(),
  DADATA_API_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.issues, null, 2));
  process.exit(1);
}

export const env = parsed.data;
