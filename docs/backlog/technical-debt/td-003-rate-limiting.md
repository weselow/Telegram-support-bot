# TD-003: Rate limiting для зеркалирования сообщений

**Severity:** LOW
**Source:** Security Review (task 006)
**File:** `src/bot/handlers/message.ts:63-69`

## Проблема

Нет ограничения на количество сообщений от одного пользователя. Злоумышленник может:
- Заспамить группу поддержки
- Исчерпать лимиты Telegram API
- Раздуть базу данных (message map)

## Влияние

- DoS для команды поддержки
- Потенциальный бан бота от Telegram
- Рост нагрузки на БД

## Рекомендация

Использовать Redis (уже настроен в env) для rate limiting:

```typescript
const RATE_LIMIT = 10; // сообщений
const RATE_WINDOW = 60; // секунд

async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `rate:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, RATE_WINDOW);
  }
  return count <= RATE_LIMIT;
}
```

## Связь с задачами

Логично реализовать в рамках задачи **012-bullmq-setup** (BullMQ + Redis).

## Приоритет

Низкий — реализовать при настройке Redis.

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
