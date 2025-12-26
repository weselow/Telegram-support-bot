# TD-015: Отмена job без обнаружения "job not found"

## Проблема

В `src/jobs/queues.ts` функция `cancelAutocloseJob` не различает "job cancelled" и "job not found".

## Текущее поведение

```typescript
const job = await autocloseQueue.getJob(jobId);
if (job) {
  await job.remove();
}
// Нет возврата результата, нет логирования если job не найден
```

## Последствия

- Нельзя отличить успешную отмену от отсутствия job
- Потенциальные проблемы с ID mismatch не обнаруживаются

## Предлагаемое решение

```typescript
export async function cancelAutocloseJob(userId, topicId): Promise<boolean> {
  const job = await autocloseQueue.getJob(jobId);
  if (!job) {
    logger.debug({ jobId }, 'Autoclose job not found (already processed or never existed)');
    return false;
  }
  await job.remove();
  return true;
}
```

## Приоритет

Низкий — текущее поведение безопасно (idempotent).

## Источник

PR review для задачи 014.

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
