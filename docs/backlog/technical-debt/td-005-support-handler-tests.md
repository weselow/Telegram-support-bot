# TD-005: Unit-тесты для support handler

**Severity:** MEDIUM
**Source:** Code Review (task 007)
**File:** `src/bot/handlers/support.ts`, `src/services/message.service.ts`

## Проблема

Новый `supportMessageHandler` и функция `mirrorSupportMessage` не имеют unit-тестов.

## Влияние

- Нет регрессионной защиты при изменениях
- TDD стандарт не соблюдён для этого модуля

## Что нужно протестировать

1. Фильтрация сообщений бота (`ctx.from.is_bot`)
2. Фильтрация General topic (`topicId` undefined)
3. Фильтрация внутренних сообщений (`//` и `#internal`)
4. Поиск пользователя по topic_id
5. Зеркалирование сообщений в DM
6. Обработка ошибок с уведомлением оператора

## Блокеры

- ESM/Jest проблемы с моками Prisma client
- Сервисы исключены из coverage в jest.config.js

## Связь с задачами

Реализовать в рамках задачи **018-tests**.

## Приоритет

Средний — реализовать при добавлении тестов.
