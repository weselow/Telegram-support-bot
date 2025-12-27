# Integration тесты для репозиториев

**Дата:** 2025-12-27
**Источник:** TD-022

## Проблема

Отсутствовали интеграционные тесты для репозиториев, работающих с реальной PostgreSQL. Это создавало риск что Prisma queries могут работать некорректно с реальной БД (особенно BigInt, composite unique keys, cascade delete).

## Причина

Изначально был указан блокер "требует инфраструктуры", но Docker-инфраструктура уже существовала в проекте (docker-compose.yml с PostgreSQL и Redis).

## Решение

Использована существующая Docker-инфраструктура:

1. **Тестовый Prisma клиент** (`test-client.ts`):
   - Подключается к отдельной БД `support_bot_test`
   - Функции connect/disconnect/cleanDatabase

2. **Global setup** (`globalSetup.ts`):
   - Создаёт тестовую БД через docker exec
   - Применяет миграции перед тестами

3. **Интеграционные тесты** (`repositories.integration.test.ts`):
   - 14 тестов для User, MessageMap, TicketEvent
   - Проверка BigInt, composite unique, cascade delete

4. **Отдельная конфигурация** (`vitest.integration.config.ts`)

## Изменённые файлы

- `src/db/__tests__/test-client.ts` — создан
- `src/db/__tests__/globalSetup.ts` — создан
- `src/db/__tests__/repositories.integration.test.ts` — создан
- `vitest.integration.config.ts` — создан
- `vitest.config.ts` — добавлен exclude для integration тестов
- `package.json` — добавлен скрипт `test:integration`
- `.env.example` — добавлен DATABASE_URL_TEST

## Важно для разработчика

**Запуск интеграционных тестов:**
```bash
# 1. Запустить контейнеры
docker-compose up -d postgres redis

# 2. Запустить тесты
pnpm run test:integration
```

**Unit тесты** (`pnpm test`) НЕ требуют Docker — они используют моки.

**Интеграционные тесты** (`pnpm run test:integration`) требуют запущенные контейнеры.
