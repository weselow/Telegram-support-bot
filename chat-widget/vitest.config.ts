import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// Та же версия, что подставляет esbuild.config.js — чтобы тесты видели ровно то,
// что попадёт в собранный файл.
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

export default defineConfig({
  define: {
    'process.env.WIDGET_VERSION': JSON.stringify(version),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
})
