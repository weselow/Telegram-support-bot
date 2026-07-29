import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['src/db/__tests__/globalSetup.ts'],
    setupFiles: ['src/db/__tests__/integration-setup.ts'],
    // Все файлы работают с одной базой support_bot_test, а cleanDatabase()
    // в src/db/__tests__/test-client.ts очищает её целиком. При параллельном
    // запуске файлов эта очистка удаляет строки, созданные другим файлом:
    // сессия веб-чата пропадает между созданием и подключением, сервер
    // закрывает соединение с кодом 4001, и тест ждёт сообщение до истечения
    // срока. Поэтому файлы выполняются строго по очереди.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    alias: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
  },
});
