# TD-009: BigInt to Number конверсия tgUserId

## Проблема

В нескольких местах кодовой базы `tgUserId` (BigInt) конвертируется в Number:

```typescript
tgUserId: Number(user.tgUserId)
```

Telegram user IDs могут превышать `Number.MAX_SAFE_INTEGER` (2^53 - 1), что приведёт к потере точности.

## Затронутые места

1. `src/services/status.service.ts:62` — TicketCardData
2. `src/services/topic.service.ts` — аналогичные конверсии
3. `src/bot/handlers/*.ts` — передача в API методы

## Последствия

При user ID > 9007199254740991 возможна некорректная идентификация пользователя.

## Предлагаемое решение

1. Изменить тип `tgUserId` в интерфейсах на `bigint | string`
2. Использовать string представление для отображения
3. Проверить все места конверсии BigInt → Number

## Приоритет

Низкий — на практике большинство user ID пока в безопасном диапазоне. Проблема станет актуальной при росте базы пользователей Telegram.

## Источник

PR review для задачи 011.
