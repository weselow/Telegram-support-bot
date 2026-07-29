# Project Conventions

Извлечено из кода 2026-07-28. Два отдельных пакета: бэкенд (`src/`) и встраиваемый виджет чата (`chat-widget/`) — у них **разные** соглашения, не переносить одни на другой.

## Tech Stack

### Бэкенд (корень репозитория)
- TypeScript 5.9.3, Node >= 22, ESM (`"type": "module"`)
- tsconfig: `target ES2022`, `module NodeNext`, `strict: true` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals/Parameters`, `noImplicitReturns`
- grammy 1.38 — Telegram Bot API
- Fastify 5.6 + `@fastify/static`, `@fastify/multipart`, `@fastify/websocket`, `ws` 8.18
- Prisma 7.2 + `@prisma/adapter-pg`, PostgreSQL 16
- BullMQ 5.66 + ioredis 5.8 (Redis 7) — очереди задач, ограничение частоты запросов, временное хранение
- pino 10 (+ pino-pretty в разработке) — журналирование
- Sentry `@sentry/node` 10.32
- zod 4.2 — проверка окружения и `config/settings.json`
- Vitest 4 + `@vitest/coverage-v8`, ESLint 9 (`strictTypeChecked` + `stylisticTypeChecked`), Prettier 3.7
- Менеджер пакетов: **pnpm**

### Виджет (`chat-widget/`)
- TypeScript 5.7, сборка esbuild 0.24 (`esbuild.config.js`), `moduleResolution: bundler`
- Без внешних зависимостей во время выполнения — только браузерные API
- Vitest 4 + jsdom, псевдоним путей `@/*` → `./src/*`
- Собранные файлы копируются в `public/chat-widget/` командой `pnpm --filter ... run build`

### Инфраструктура
- docker-compose: только локальная разработка — `app` + postgres + redis; образ `ghcr.io/weselow/telegram-support-bot`
- Production — Coolify: приложение, PostgreSQL и Redis отдельными ресурсами, HTTPS и домен на встроенном прокси. Подробности в `docs/deployment.md`
- GitHub Actions: `test.yml` (линт+typecheck, юнит-тесты с покрытием, интеграционные тесты на postgres:5433/redis:6380), `deploy.yml` (сборка образа → webhook Coolify), `claude*.yml`

## Architecture

- **Стиль:** слоями, без классов на бэкенде. `bot / http → services → db/repositories → prisma`
- **Точка входа:** `src/index.ts` — последовательный запуск (БД → рабочие процессы → HTTP → бот) и корректное завершение по SIGINT/SIGTERM
- **Поток Telegram:** `bot/bot.ts` регистрирует обработчики через `bot.on(...).filter(...)` (фильтр по типу чата и `SUPPORT_GROUP_ID`) → `bot/handlers/*.ts` → сервисы
- **Поток HTTP:** `http/server.ts` регистрирует модули маршрутов (`fastify.register`) → `http/routes/*.ts` → сервисы. Маршрут = экспортируемая функция-модуль Fastify
- **Поток WebSocket:** `http/ws/websocket.ts` (регистрация) → `handler.ts` (разбор + маршрутизация по типу сообщения через `switch`) → сервисы; `connection-manager.ts` держит активные соединения
- **Фоновые задачи:** BullMQ, очереди в `jobs/queues.ts`, рабочие процессы `jobs/*.worker.ts` (SLA-напоминания, автозакрытие)
- **Доступ к данным:** тонкая обёртка-репозиторий поверх Prisma (`src/db/repositories/*.repository.ts`). Интерфейсов репозиториев нет, обёртка возвращает Prisma-модели напрямую
- **Проверка данных:** zod только для окружения (`config/env.ts`) и `config/settings.ts`. Тела HTTP-запросов и сообщения WebSocket проверяются вручную (защитные функции вида `isValidClientMessage`, проверки длины через константы `MESSAGE_MAX_LENGTH`)
- **Преобразование данных:** ручное, библиотек нет
- **Обработка ошибок:** исключения + перехват на границах. Глобальный `bot.catch` в `bot/bot.ts`; в HTTP-маршрутах локальный `try/catch` → `{ success: false, error: { code, message } }`; сервисы либо пробрасывают исключение, либо возвращают `null`. Паттернов Result/Either нет
- **Внедрение зависимостей:** отсутствует. Модули импортируют друг друга напрямую; подмена в тестах — через `vi.mock`
- **Состояние модуля:** синглтоны в переменных модуля (`let server`, `let worker`) с функциями `startX` / `stopX`
- **Sentry:** `captureError(error, { action, ...context })` и `addBreadcrumb(...)` из `config/sentry.js` — вызывать рядом с `logger.error`

## Structure

```
src/
├── index.ts                  точка входа, запуск и остановка
├── bot/
│   ├── bot.ts                экземпляр grammy, регистрация обработчиков, bot.catch
│   ├── handlers/             обработчики обновлений Telegram (+ __tests__/)
│   └── middleware/
├── http/
│   ├── server.ts             экземпляр Fastify, регистрация маршрутов
│   ├── routes/               модули маршрутов Fastify (+ __tests__/)
│   ├── middleware/           хуки (bot-filter)
│   ├── utils/                разбор cookie сессии
│   └── ws/                   WebSocket: websocket.ts, handler.ts, connection-manager.ts, types.ts
├── services/                 бизнес-логика (+ __tests__/)
├── db/
│   ├── client.ts             экземпляр PrismaClient + connect/disconnect
│   ├── repositories/         обёртки над Prisma
│   └── __tests__/            настройка и интеграционные тесты БД
├── jobs/                     очереди BullMQ и рабочие процессы
├── config/                   env, settings, messages, redis, sentry
├── constants/                словари меток статусов
├── utils/                    logger, cors, file-validation
└── generated/prisma/         сгенерированный клиент Prisma — НЕ РЕДАКТИРОВАТЬ

chat-widget/src/
├── widget.ts                 класс ChatWidget + WIDGET_VERSION
├── core/                     StateManager, EventEmitter
├── transport/                HttpClient, WebSocketClient
├── ui/                       компоненты интерфейса
├── utils/, types/, styles/
└── __tests__/                зеркалит структуру src/

prisma/                       schema.prisma + migrations/
config/settings.json          сроки SLA и автозакрытия (проверяется zod)
```

## Naming

**Файлы:** kebab-case, суффикс по роли:
- `*.service.ts` — сервисы; `*.repository.ts` — репозитории; `*.worker.ts` — рабочие процессы
- Маршруты — без суффикса (`chat.ts`, `health.ts`), кроме `media.routes.ts` (единичное исключение)
- Обработчики бота — без суффикса (`start.ts`, `message.ts`)
- Тесты — `[имя].test.ts`, интеграционные — `[имя].integration.test.ts`

**Экспорты:**
- Репозитории — объект: `export const userRepository = { async findById(...) {...} }`. Один объект = одна таблица
- Сервисы — **отдельные функции**: `export async function createTicket(...)`. Не заворачивать сервис в объект: классов на бэкенде нет, объект-обёртка создаёт видимость сущности с состоянием там, где её нет, и мешает точечному импорту. Исключений в коде нет
- Обработчики — `export async function startHandler(ctx: Context): Promise<void>`
- Маршруты — `export function askSupportRoute(fastify: FastifyInstance)` / `export async function chatRoutes(...)`
- Классов на бэкенде **нет ни одного**. В виджете, наоборот, всё классы

**Прочее:**
- Интерфейсы без префикса `I`. Данные для создания — `CreateXData`, результат — `XResult`
- Константы модуля — `SCREAMING_SNAKE_CASE` вверху файла (`MESSAGE_MAX_LENGTH`, `REDIRECT_TTL`)
- Методы: `findBy*` для чтения (возвращают `null`), `create`, `update*`; сервисы — `getX`, `startX`/`stopX`/`cancelX`
- Импорты типов обязательно через `import type` (правило ESLint `consistent-type-imports`)
- **Импорты на бэкенде — с расширением `.js`** (NodeNext): `import { logger } from '../utils/logger.js'`. В виджете — **без расширения**
- Стиль: точки с запятой, одинарные кавычки, ширина 100, отступ 2 (`.prettierrc`). В виджете точки с запятой **не ставятся**

## Testing

- **Инструмент:** Vitest 4, `globals: true`, среда `node` (в виджете — `jsdom`)
- **Расположение:** тесты лежат рядом с кодом в `src/**/__tests__/`. Корневые папки `tests/unit/` и `tests/integration/` содержат только `.gitkeep` — не использовать
- **Проверки:** встроенный `expect` (`toEqual`, `toBe`, `toBeNull`, `rejects.toThrow`)
- **Заглушки:** `vi.mock('../путь.js', () => ({...}))` на уровне файла + `vi.fn()`; `vi.clearAllMocks()` в `beforeEach`; доступ к заглушкам через `await import(...)` внутри `beforeEach`. Папка `src/db/repositories/__mocks__/` пуста — механизм автозаглушек Vitest не используется
- **Именование:** внешний `describe` — **имя проверяемого модуля без расширения**: `describe('ticket.service')`, `describe('file-validation')`, `describe('ask-support')`. Не писать `describe('TicketService')` — класса с таким именем не существует, заголовок вводит в заблуждение и не находится поиском по репозиторию. Вложенный `describe('имяФункции')`, случаи — `it('should ...')`. В виджете классы настоящие, там внешний `describe` — имя класса (`describe('StateManager')`)
- **Структура:** Arrange-Act-Assert без комментариев-заголовков; тестовые данные — объектные литералы прямо в тесте, построителей и фабрик нет
- **Интеграционные тесты:** отдельный `vitest.integration.config.ts`, **настоящая** PostgreSQL в Docker на порту 5433 (`support_bot_test`), миграции накатываются в `globalSetup.ts`, переменные окружения задаются в `integration-setup.ts`. Запуск: `pnpm run test:integration` (нужен `docker compose up -d postgres redis`)
- **Покрытие:** порог 60% по всем метрикам; большой список исключений в `vitest.config.ts` — при добавлении тестов на файл из списка убрать его оттуда

## Do NOT Use

- **Не редактировать `src/generated/prisma/**`** — перегенерируется командой `pnpm run db:generate`
- **Не заводить классы на бэкенде** — только функции и объектные литералы
- **Не заводить интерфейсы над репозиториями** и не абстрагировать Prisma глубже тонкой обёртки
- **Не применять паттерн Result/Either** — исключения плюс `null` для «не найдено»
- **Не подключать библиотеки внедрения зависимостей** (tsyringe, inversify) — их нет и модули связаны прямыми импортами
- **Не подключать библиотеки преобразования данных** (AutoMapper-подобные) — преобразование ручное
- **Не добавлять зависимости во время выполнения в `chat-widget/`** — виджет намеренно без внешних зависимостей
- **Не использовать `: any`** — в рабочем коде бэкенда нет ни одного вхождения; ESLint настроен на `strictTypeChecked`
- **Не писать `console.log`** в рабочем коде — только `logger` из `utils/logger.js` (исключения: `config/env.ts` до инициализации журнала и настройка тестов)
- **Не глотать ошибки молча** — рядом с `logger.error` вызывать `captureError` с полем `action`
- **Не использовать npm/yarn** — только pnpm (в репозитории `pnpm-lock.yaml`)
- **Не класть тесты в корневые `tests/unit` и `tests/integration`** — они не подключены к рабочему процессу
