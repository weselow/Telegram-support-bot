import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['src/db/__tests__/globalSetup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    alias: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
  },
});
