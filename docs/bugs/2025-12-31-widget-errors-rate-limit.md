# Server-side rate limiting для /api/widget/errors

**Дата:** 2025-12-31
**Источник:** TD-042

## Проблема

Rate limiting для endpoint `/api/widget/errors` был реализован только на клиенте. Злоумышленник мог обойти клиентский код и слать запросы напрямую, потенциально флудя Sentry и логи.

## Решение

Добавлен server-side rate limiting через существующий `checkKeyRateLimit`:
- 20 запросов в минуту на origin
- Использует Redis (распределённый, работает на кластере)
- Возвращает стандартные rate limit headers

## Изменённые файлы

- `src/http/routes/widget-errors.ts` — добавлен rate limiting
- `src/http/routes/__tests__/widget-errors.test.ts` — добавлены 3 теста

## Технические детали

```typescript
// Rate limiting by origin
const origin = request.headers.origin ?? 'unknown';
const rateLimitResult = await checkKeyRateLimit(`widget-errors:${origin}`, {
  maxRequests: 20,
  windowSeconds: 60,
});
```

Response headers:
- `X-RateLimit-Limit: 20`
- `X-RateLimit-Remaining: N`
- `X-RateLimit-Reset: seconds`

При превышении лимита возвращается 429:
```json
{
  "success": false,
  "error": { "code": "RATE_LIMIT", "message": "Too many requests" }
}
```

## Важно для разработчика

- Rate limit привязан к origin, не к IP
- Не добавлена новая зависимость — использован существующий сервис
- Widget клиент уже обрабатывает 429 (TD-031)
