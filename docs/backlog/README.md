# Backlog проекта

## Задачи по этапам

### Этап 1: Фундамент

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| [001](../solutions/001-project-init/001-project-init.md) | Инициализация проекта | DONE | Высокий |
| [002](../solutions/002-docker-setup/002-docker-setup.md) | Docker-композиция | DONE | Высокий |
| [003](../solutions/003-database-schema/003-database-schema.md) | Prisma-схема и миграции | DONE | Высокий |
| [004](../solutions/004-basic-bot/004-basic-bot.md) | Базовый бот | DONE | Высокий |

### Этап 2: Основной функционал

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| [005](../solutions/005-topic-creation/005-topic-creation.md) | Создание топика | DONE | Высокий |
| [006](../solutions/006-mirror-user-to-topic/006-mirror-user-to-topic.md) | Зеркалирование user → topic | DONE | Высокий |
| [007](../solutions/007-mirror-topic-to-user/007-mirror-topic-to-user.md) | Зеркалирование topic → user | DONE | Высокий |
| [008](../solutions/008-ticket-card-buttons/008-ticket-card-buttons.md) | Карточка тикета с кнопками | DONE | Высокий |

### Этап 3: Расширенный функционал

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| [009](../solutions/009-edit-delete-messages/009-edit-delete-messages.md) | Редактирование сообщений | DONE | Средний |
| [010](../solutions/010-auto-status-change/010-auto-status-change.md) | Автосмена статусов | DONE | Средний |
| [011](../solutions/011-ticket-history/011-ticket-history.md) | История событий | DONE | Средний |

### Этап 4: SLA и автоматизация

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| [012](../solutions/012-bullmq-setup/012-bullmq-setup.md) | BullMQ + Redis | DONE | Средний |
| [013](../solutions/013-sla-timers/013-sla-timers.md) | SLA-таймеры | DONE | Средний |
| [014](../solutions/014-autoclose/014-autoclose.md) | Автозакрытие 7 дней | DONE | Средний |

### Этап 5: Полировка

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| [015](../solutions/015-config-json/015-config-json.md) | Конфиг из config.json | DONE | Низкий |
| [016](../solutions/016-sentry-integration/016-sentry-integration.md) | Sentry интеграция | DONE | Низкий |
| [017](../solutions/017-bot-blocked-handling/017-bot-blocked-handling.md) | Обработка блокировки | DONE | Низкий |
| [018](../solutions/018-tests/018-tests.md) | Тесты | DONE | Средний |
| [019](../solutions/019-website-integration/019-website-integration.md) | Интеграция с сайтом (/ask-support) | DONE | Высокий |
| [020](../solutions/020-onboarding-flow/020-onboarding-flow.md) | Onboarding Flow для пользователей | DONE | Средний |

### Этап 6: Web-интеграция

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| [021](../solutions/021-web-chat-api/021-web-chat-api.md) | Web Chat API | DONE | Высокий |
| [022](../solutions/022-cors-configuration/022-cors-configuration.md) | CORS Configuration | DONE | Высокий |

---

## Технический долг

### В ожидании

| # | Задача | Приоритет |
|---|--------|-----------|
| [TD-024](technical-debt/td-024-history-copy-on-migration.md) | Копирование истории при миграции в Telegram | Низкий |
| [TD-027](technical-debt/td-027-ticket-status-type.md) | Типизация: TicketStatus union type | Средний |
| [TD-028](technical-debt/td-028-widget-offline-mode.md) | Chat Widget: Offline режим | Высокий |
| [TD-029](technical-debt/td-029-widget-analytics.md) | Chat Widget: Analytics интеграция | Низкий |
| [TD-030](technical-debt/td-030-widget-http-401-handling.md) | Chat Widget: HTTP 401 handling | Высокий |
| [TD-031](technical-debt/td-031-widget-http-429-handling.md) | Chat Widget: HTTP 429 handling | Низкий |
| [TD-032](technical-debt/td-032-widget-variant-switcher.md) | Chat Widget: Переключатель modal/drawer | Низкий |
| [TD-033](technical-debt/td-033-widget-unit-tests.md) | Chat Widget: Unit-тесты | Средний |
| [TD-035](technical-debt/td-035-statusbar-cleanup.md) | Chat Widget: Cleanup в StatusBar | Низкий |
| [TD-036](technical-debt/td-036-dry-cors-error-response.md) | DRY: CORS error response в helper | Средний |
| [TD-037](technical-debt/td-037-widget-error-logger.md) | Chat Widget: Error Logger (мини-Sentry) | Средний |

### Выполнено

| # | Задача | Статус |
|---|--------|--------|
| [TD-001](../bugs/2025-12-27-notify-unsupported-message-types.md) | Уведомление о неподдерживаемых типах сообщений | DONE |
| [TD-022](../bugs/2025-12-29-web-chat-service-unit-tests.md) | Unit-тесты для WebChatService | DONE |
| [TD-023](../bugs/2025-12-29-websocket-integration-tests.md) | Integration-тесты для WebSocket API | DONE |
| [TD-026](../bugs/2025-12-27-migrate-npm-to-pnpm.md) | Миграция npm → pnpm | DONE |
| [TD-025](../bugs/2025-12-29-dry-session-parsing.md) | DRY: вынести session parsing | DONE |
| [TD-034](../solutions/022-cors-configuration/022-cors-configuration.md) | WebSocket: Origin validation | DONE (в рамках 022) |

---

## Идеи на будущее

- ~~Web-чат интеграция~~ → реализовано в [021](../solutions/021-web-chat-api/021-web-chat-api.md)

---

## Работа с задачами

### Начало работы над задачей

1. Измени статус в файле задачи: `TODO` → `IN PROGRESS`
2. Создай папку для решений: `docs/solutions/[номер]-[название]/`
3. Создай файл `decisions.md` в этой папке
4. Веди историю принятых решений по мере работы

### Завершение задачи

1. Измени статус: `IN PROGRESS` → `DONE`
2. Обнови этот README
3. Сделай коммит с описанием выполненной работы
