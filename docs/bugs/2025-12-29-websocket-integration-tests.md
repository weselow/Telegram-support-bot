# WebSocket Integration Tests

**Дата:** 2025-12-29
**Источник:** TD-023

## Проблема

WebSocket API (`/ws/chat`) не был покрыт тестами. Файлы `src/http/ws/**` и `src/http/routes/chat.ts` были исключены из coverage.

## Причина

При разработке задачи 021-web-chat-api интеграционные тесты были отложены как технический долг из-за сложности настройки ESM-совместимых моков для Vitest.

## Решение

1. **Создан тестовый setup для интеграционных тестов**:
   - Добавлен `src/db/__tests__/integration-setup.ts` - настройка env переменных
   - Обновлён `vitest.integration.config.ts` с setupFiles

2. **Реализованы 18 интеграционных тестов** в `src/http/ws/__tests__/websocket.integration.test.ts`:
   - Подключение с валидной/невалидной сессией (4 теста)
   - Отправка сообщений и валидация (5 тестов)
   - Typing indicator (2 теста)
   - Close ticket (2 теста)
   - Pong keep-alive (1 тест)
   - Rate limiting (1 тест)
   - Unknown message type (1 тест)
   - Получение сообщений от поддержки (2 теста)

3. **Особенности реализации**:
   - Используется `vi.hoisted()` для создания общего Prisma клиента
   - Каждый тест создаёт собственного пользователя для изоляции
   - Мокируются только внешние сервисы (Telegram Bot API, rate limiter)
   - Реальная БД используется для тестирования

## Изменённые файлы

- `src/http/ws/__tests__/websocket.integration.test.ts` — 18 интеграционных тестов
- `src/db/__tests__/integration-setup.ts` — setup для env переменных
- `vitest.integration.config.ts` — добавлен setupFiles
- `vitest.config.ts` — обновлены комментарии для ws/**

## Важно для разработчика

### ESM Mocking в Vitest

При тестировании ESM модулей с Vitest:

1. **Используй `vi.hoisted()`** для создания объектов, которые нужны в `vi.mock()`:
```typescript
const { testPrisma } = await vi.hoisted(async () => {
  // Создаём клиент здесь
  return { testPrisma: new PrismaClient({ adapter }) };
});

vi.mock('../db/client.js', () => ({
  prisma: testPrisma,  // Используем созданный выше
}));
```

2. **Не используй shared state между beforeAll и тестами** — создавай данные внутри каждого теста.

3. **Мокируй только внешние зависимости** (Telegram Bot, Redis) — БД лучше тестировать реально.

## Не реализовано

- Тест "Reconnect и получение пропущенных сообщений" — требует дополнительной инфраструктуры
- E2E сценарий Web → Topic → Web — покрыт частично через отдельные тесты
