# TD-018: Отсутствие обработки ошибок в Redis конфигурации

## Проблема

В `src/config/redis.ts` парсинг Redis URL и валидация порта выполняются без обработки ошибок.

## Текущее поведение

```typescript
// URL парсинг без try-catch
const url = new URL(env.REDIS_URL);

// Порт может быть NaN или вне диапазона
const port = parseInt(url.port || '6379', 10);
```

## Последствия

- Некорректный REDIS_URL вызовет непонятную ошибку
- Невалидный порт может привести к silent connection failures

## Предлагаемое решение

```typescript
let url: URL;
try {
  url = new URL(env.REDIS_URL);
} catch (error) {
  throw new Error(`Invalid REDIS_URL format: ${env.REDIS_URL}`, { cause: error });
}

const port = parseInt(url.port || '6379', 10);
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid Redis port: ${url.port}`);
}
```

## Приоритет

Средний — ошибки конфигурации должны быть понятными.

## Источник

Code review для задачи 015.

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
