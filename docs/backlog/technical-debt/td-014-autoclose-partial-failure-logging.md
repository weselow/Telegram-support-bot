# TD-014: Partial failures в autoclose worker логируются как success

## Проблема

В `src/jobs/autoclose.worker.ts` несколько операций могут провалиться, но job логирует "Ticket autoclosed successfully".

## Текущее поведение

```typescript
// event creation может fail
// card update может fail
// client notification может fail
// topic notification может fail
logger.info({ userId, topicId }, 'Ticket autoclosed successfully');
```

## Последствия

- Мониторинг показывает успех при частичных сбоях
- Сложнее понять реальное состояние тикета

## Предлагаемое решение

Агрегировать результаты и логировать реальный статус:
```typescript
const failures = [];
// ... collect failures ...
if (failures.length > 0) {
  logger.warn({ userId, topicId, failures }, 'Ticket autoclosed with partial failures');
} else {
  logger.info({ userId, topicId }, 'Ticket autoclosed successfully');
}
```

## Приоритет

Низкий — основная операция (смена статуса) логируется корректно.

## Источник

PR review для задачи 014.
