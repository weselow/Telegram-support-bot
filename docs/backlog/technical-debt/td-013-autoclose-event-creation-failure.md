# TD-013: Event creation failure в autoclose worker

## Проблема

В `src/jobs/autoclose.worker.ts` ошибка создания события логируется, но аудит неполный.

## Текущее поведение

```typescript
try {
  await eventRepository.create({...});
} catch (error) {
  logger.error({ error }, 'Failed to create autoclose event');
  // продолжаем выполнение
}
```

## Последствия

- Тикет закрыт, но нет записи в истории событий
- Сложнее дебажить и отслеживать автозакрытия

## Предлагаемое решение

1. Добавить метрику для отслеживания сбоев event creation
2. Рассмотреть retry механизм или включение в транзакцию

## Приоритет

Низкий — логирование есть, audit trail не критичен.

## Источник

PR review для задачи 014.
