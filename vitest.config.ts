import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
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
        'src/services/**',
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
