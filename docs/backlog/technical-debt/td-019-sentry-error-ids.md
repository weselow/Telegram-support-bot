# TD-019: Добавить Error IDs для Sentry fingerprinting

## Проблема

Все ошибки отправляются в Sentry без уникальных идентификаторов, что затрудняет группировку и отслеживание похожих ошибок.

## Текущее поведение

```typescript
captureError(error, { userId, action: 'createTicket' });
// Нет уникального errorId для группировки
```

## Последствия

- Похожие ошибки из разных путей кода могут быть сгруппированы неправильно
- Сложнее настроить алерты для конкретных типов ошибок
- Сложнее измерить эффективность исправлений

## Предлагаемое решение

Создать `src/constants/errorIds.ts`:
```typescript
export const ERROR_IDS = {
  TICKET_CREATE_FAILED: 'E001',
  MESSAGE_MIRROR_FAILED: 'E002',
  STATUS_UPDATE_FAILED: 'E003',
  // ...
} as const;
```

Использовать в captureError:
```typescript
captureError(error, {
  userId,
  action: 'createTicket',
  errorId: ERROR_IDS.TICKET_CREATE_FAILED
});
```

## Приоритет

Низкий — текущая реализация работает, улучшение для observability.

## Источник

Code review для задачи 016.
