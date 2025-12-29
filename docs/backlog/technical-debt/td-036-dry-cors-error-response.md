# TD-036: DRY — вынести CORS error response в helper

**Дата:** 2025-12-29
**Приоритет:** Средний
**Сложность:** Низкая (10 мин)

## Проблема

В `src/http/routes/chat.ts` одинаковый код CORS error response повторяется 7 раз:

```typescript
return reply.status(403).send({
  success: false,
  error: { code: 'CORS_ERROR', message: 'Origin not allowed' }
});
```

Строки: 72, 80, 134, 176, 211, 277, 312

## Риски без исправления

- При изменении формата ответа нужно менять в 7 местах
- Возможна рассинхронизация между endpoints

## Решение

Создать helper функцию:

```typescript
function sendCorsError(reply: FastifyReply) {
  return reply.status(403).send({
    success: false,
    error: { code: 'CORS_ERROR', message: 'Origin not allowed' }
  });
}
```

Заменить все вхождения на:

```typescript
if (!setCorsHeaders(request, reply)) {
  return sendCorsError(reply);
}
```

## Файлы для изменения

- [ ] `src/http/routes/chat.ts` — создать helper, заменить 7 вхождений
