# TD-007: Refactoring callbackHandler

## Проблема

Функция `callbackHandler` в `src/bot/handlers/callback.ts` превышает рекомендуемый лимит в 30 строк (сейчас ~80 строк). Это нарушает метрику из GLOBAL-implementation-standard.md.

## Текущее состояние

Функция выполняет несколько ответственностей:
1. Парсинг callback_data
2. Валидация пользователя и статуса
3. Обновление статуса в БД
4. Создание события
5. Обновление карточки тикета
6. Отправка уведомления в топик
7. Ответ на callback query

## Предлагаемое решение

Разбить на отдельные функции:
- `validateStatusChange(ctx, parsed)` — валидация
- `applyStatusChange(userId, status, oldStatus)` — БД операции
- `notifyStatusChange(ctx, user, oldStatus, status, cardUpdateFailed)` — уведомления

## Приоритет

Низкий — функциональность работает корректно, код читаем.

## Источник

PR review для задачи 008.

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
