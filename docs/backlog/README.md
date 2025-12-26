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
| [007](tasks/007-mirror-topic-to-user.md) | Зеркалирование topic → user | TODO | Высокий |
| [008](tasks/008-ticket-card-buttons.md) | Карточка тикета с кнопками | TODO | Высокий |

### Этап 3: Расширенный функционал

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| [009](tasks/009-edit-delete-messages.md) | Редактирование и удаление | TODO | Средний |
| [010](tasks/010-auto-status-change.md) | Автосмена статусов | TODO | Средний |
| [011](tasks/011-ticket-history.md) | История событий | TODO | Средний |

### Этап 4: SLA и автоматизация

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| [012](tasks/012-bullmq-setup.md) | BullMQ + Redis | TODO | Средний |
| [013](tasks/013-sla-timers.md) | SLA-таймеры | TODO | Средний |
| [014](tasks/014-autoclose.md) | Автозакрытие 7 дней | TODO | Средний |

### Этап 5: Полировка

| # | Задача | Статус | Приоритет |
|---|--------|--------|-----------|
| [015](tasks/015-config-json.md) | Конфиг из config.json | TODO | Низкий |
| [016](tasks/016-sentry-integration.md) | Sentry интеграция | TODO | Низкий |
| [017](tasks/017-bot-blocked-handling.md) | Обработка блокировки | TODO | Низкий |
| [018](tasks/018-tests.md) | Тесты | TODO | Средний |

---

## Идеи на будущее

- [Web-чат интеграция](ideas/web-chat-integration.md)

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
