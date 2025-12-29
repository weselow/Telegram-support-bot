import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts', 'node_modules'],
    passWithNoTests: true,
    alias: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/generated/**',
        'src/index.ts',
        'src/db/**',
        'src/bot/bot.ts',
        'src/utils/logger.ts',
        'src/services/status.service.ts',
        'src/services/autoclose.service.ts',
        'src/services/topic.service.ts',
        'src/services/group.service.ts',
        'src/bot/handlers/message.ts',
        'src/bot/handlers/callback.ts',
        'src/bot/handlers/edit.ts',
        'src/bot/handlers/support.ts',
        'src/bot/handlers/resolve.ts',
        'src/bot/handlers/phone.ts',
        'src/bot/handlers/private-callback.ts',
        'src/bot/handlers/history.ts',
        'src/constants/**',
        'src/config/env.ts',
        'src/config/sentry.ts',
        'src/config/settings.ts',
        'src/config/redis.ts',
        'src/config/redis-client.ts',
        'src/http/server.ts',
        'src/http/routes/health.ts',
        'src/http/routes/chat.ts', // Tested via integration tests
        'src/http/ws/**', // Tested via integration tests (TD-023)
        'src/bot/handlers/onboarding.ts',
        'src/jobs/**',
      ],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
});
