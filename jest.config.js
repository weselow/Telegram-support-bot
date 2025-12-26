/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  passWithNoTests: true,
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/generated/**',
    '!src/index.ts',
    '!src/db/**',
    '!src/bot/bot.ts',
    '!src/utils/logger.ts',
    '!src/services/**',
    '!src/bot/handlers/message.ts',
    '!src/bot/handlers/callback.ts',
    '!src/bot/handlers/edit.ts',
    '!src/bot/handlers/support.ts',
    '!src/bot/handlers/resolve.ts',
    '!src/bot/handlers/phone.ts',
    '!src/bot/handlers/private-callback.ts',
    '!src/bot/handlers/history.ts',
    '!src/constants/**',
    '!src/config/env.ts',
    '!src/config/sentry.ts',
    '!src/config/settings.ts',
    '!src/config/redis.ts',
    '!src/jobs/**',
  ],
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 60,
      functions: 60,
      lines: 60,
    },
  },
};
