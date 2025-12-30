# DRY: CORS error response в helper

**Дата:** 2025-12-30
**Источник:** TD-036

## Проблема

В файле `src/http/routes/chat.ts` одинаковый код возврата CORS-ошибки повторялся 7 раз:

```typescript
return reply.status(403).send({
  success: false,
  error: { code: 'CORS_ERROR', message: 'Origin not allowed' }
});
```

При изменении формата ответа требовалось бы менять в 7 местах.

## Решение

Создана helper-функция `sendCorsError()`:

```typescript
function sendCorsError(reply: FastifyReply) {
  return reply.status(403).send({
    success: false,
    error: { code: 'CORS_ERROR', message: 'Origin not allowed' },
  });
}
```

Все 7 вхождений заменены на:

```typescript
if (!setCorsHeaders(request, reply)) {
  return sendCorsError(reply);
}
```

## Изменённые файлы

- `src/http/routes/chat.ts` — добавлена функция `sendCorsError()`, заменены 7 вхождений

## Важно для разработчика

- `sendCorsError()` — единая точка для CORS 403 ответа
- При добавлении новых endpoints использовать эту функцию
- Функция не экспортируется, используется только внутри модуля
