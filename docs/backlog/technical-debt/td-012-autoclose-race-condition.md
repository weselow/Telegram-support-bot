# TD-012: Race condition в autoclose worker

## Проблема

В `src/jobs/autoclose.worker.ts` статус проверяется и обновляется в два отдельных запроса. Между ними статус может измениться (например, клиент ответил).

## Текущее поведение

```typescript
const user = await userRepository.findById(userId);
if (user.status !== 'WAITING_CLIENT') {
  return; // skip
}
// ... время проходит ...
await userRepository.updateStatus(userId, 'CLOSED');
```

## Последствия

Теоретически возможен race condition: тикет может быть закрыт сразу после ответа клиента.

## Предлагаемое решение

Использовать атомарное условное обновление:
```typescript
const updated = await userRepository.updateStatusIfCurrent(
  userId,
  'WAITING_CLIENT',
  'CLOSED'
);
if (!updated) {
  logger.debug({ userId }, 'Status changed, skipping autoclose');
  return;
}
```

## Приоритет

Низкий — вероятность race condition минимальна (7 дней vs миллисекунды).

## Источник

PR review для задачи 014.
