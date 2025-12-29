# TD-034: WebSocket — Проверка Origin header

**Приоритет:** Low
**Статус:** В ожидании
**Модуль:** backend (src/http/ws)

## Описание

Добавить проверку `Origin` header при WebSocket подключении как дополнительный слой защиты.

## Текущее состояние

WebSocket endpoint `/ws/chat` проверяет:
- ✅ Session ID из cookie
- ✅ Валидность сессии в БД
- ❌ Origin header не проверяется

## Почему Low приоритет

Session validation уже обеспечивает защиту. Origin — дополнительный слой, но:
- Cookie с SameSite=Lax уже защищает от CSRF
- Session привязана к конкретному пользователю
- Без valid session подключение отклоняется

## Предлагаемое решение

```typescript
// src/http/ws/websocket.ts
const allowedOrigins = env.SUPPORT_DOMAIN
  ? [`https://${env.SUPPORT_DOMAIN}`, `https://${env.SUPPORT_DOMAIN.replace('chat.', '')}`]
  : null;

fastify.get('/ws/chat', { websocket: true }, async (socket, request) => {
  // Origin check (in production)
  if (allowedOrigins) {
    const origin = request.headers.origin;
    if (!origin || !allowedOrigins.includes(origin)) {
      socket.close(4003, 'Origin not allowed');
      return;
    }
  }
  // ... existing code
});
```

## Связанные файлы

- `src/http/ws/websocket.ts`
