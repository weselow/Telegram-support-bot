# TD-025: DRY — вынести session parsing

**Дата:** 2025-12-29
**Приоритет:** Средний
**Сложность:** Низкая (15 мин)

## Проблема

Дублирование кода парсинга сессии в двух файлах:
- `src/http/routes/chat.ts` — функция `getSessionId()`
- `src/http/ws/websocket.ts` — функция `getSessionIdFromCookie()`

Также дублируются константы:
- `SESSION_COOKIE_NAME = 'webchat_session'`
- `UUID_REGEX` для валидации формата

## Риски без исправления

- При изменении логики парсинга нужно менять в 2 местах
- Возможна рассинхронизация валидации между HTTP и WebSocket

## Решение

1. Создать `src/http/utils/session.ts`:
```typescript
export const SESSION_COOKIE_NAME = 'webchat_session';
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseSessionIdFromCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  const regex = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`);
  const match = regex.exec(cookieHeader);
  const sessionId = match?.[1] ?? null;

  if (sessionId && !UUID_REGEX.test(sessionId)) {
    return null;
  }

  return sessionId;
}
```

2. Обновить импорты в `chat.ts` и `websocket.ts`

## Файлы для изменения

- [ ] Создать: `src/http/utils/session.ts`
- [ ] Изменить: `src/http/routes/chat.ts`
- [ ] Изменить: `src/http/ws/websocket.ts`
