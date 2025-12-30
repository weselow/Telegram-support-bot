# TD-042: Server-side rate limiting для /api/widget/errors

**Дата:** 2025-12-30
**Приоритет:** Низкий
**Сложность:** Низкая (1 час)
**Источник:** Security review TD-037

## Проблема

Rate limiting для endpoint `/api/widget/errors` реализован только на клиенте. Злоумышленник может обойти клиентский код и слать запросы напрямую.

## Смягчающие факторы (почему низкий приоритет)

- CORS защита ограничивает источники (только разрешённые домены)
- Batch limit (10 ошибок за запрос) уже есть
- Sentry имеет собственные rate limits
- Endpoint не выполняет тяжёлых операций

## Решение

Добавить rate limiting через `@fastify/rate-limit`:

```typescript
import rateLimit from '@fastify/rate-limit'

// В widgetErrorsRoutes:
fastify.register(rateLimit, {
  max: 20,           // запросов
  timeWindow: '1 minute',
  keyGenerator: (req) => req.headers.origin || req.ip,
  hook: 'preHandler'
})
```

## Альтернативы

1. **Nginx rate limiting** — если backend за reverse proxy, можно настроить там
2. **Redis-based limiting** — для распределённых систем (overkill для текущего проекта)

## Файлы для изменения

- `src/http/routes/widget-errors.ts`
- `package.json` — добавить `@fastify/rate-limit`

## Метрики успеха

- Rate limit 20 req/min per origin работает
- Существующие тесты проходят
- Добавлен тест на rate limiting
