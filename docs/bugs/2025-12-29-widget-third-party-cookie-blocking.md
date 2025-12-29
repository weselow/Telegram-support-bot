# Widget: Third-party cookie blocking

**Дата:** 2025-12-29
**Статус:** DONE

## Проблема

Чат-виджет не может подключиться к WebSocket на некоторых браузерах. В консоли ошибка:
```
[ChatWidget] Cannot send message, not connected
Tracking Prevention blocked access to storage for <URL>
```

## Причина

Браузеры с включённым Tracking Prevention (Edge, Safari, Firefox с ETP) блокируют **third-party cookies**:

1. Сайт: `dellshop.ru`
2. API: `chat.dellshop.ru`
3. Браузер считает `chat.dellshop.ru` "third-party" доменом
4. Cookie `webchat_session` от `/api/chat/init` не сохраняется
5. WebSocket подключается без cookie → сервер отклоняет (код 4001)

**Важно:** Это НЕ проблема CORS. CORS настроен правильно, HTTP запросы проходят.

## Решение

Двухуровневая защита:

1. **SameSite=None + Partitioned** — cookies работают в Chrome/Firefox/Edge
2. **Query parameter fallback** — для Safari и браузеров с полной блокировкой

### Backend: Cookie с SameSite=None

```typescript
// src/http/routes/chat.ts
// Production:
`${name}=${sessionId}; Path=/; Max-Age=...; HttpOnly; SameSite=None; Secure; Partitioned`
// Development:
`${name}=${sessionId}; Path=/; Max-Age=...; HttpOnly; SameSite=Lax`
```

| Атрибут | Назначение |
|---------|------------|
| SameSite=None | Разрешить cross-site cookies |
| Secure | Обязательно для SameSite=None |
| Partitioned | CHIPS — изоляция по top-level сайту |

### Backend: Query parameter fallback (уже поддерживал)

```typescript
// src/http/ws/websocket.ts
const cookieSessionId = parseSessionIdFromCookie(request.headers.cookie);
const querySessionId = (request.query as { session?: string }).session;
const sessionId = cookieSessionId ?? querySessionId;
```

### Frontend (исправлено)

1. **InitResponse** — добавлен `sessionId` в тип ответа
2. **storage.ts** — добавлены `saveSessionId()` / `loadSessionId()`
3. **widget.ts** — сохраняет sessionId из init response в localStorage
4. **websocket.ts** — передаёт sessionId в URL как `?session=<uuid>`

## Изменённые файлы

### Backend
- [x] `src/http/routes/chat.ts` — SameSite=None; Secure; Partitioned для cookies

### Frontend (chat-widget)
- [x] `chat-widget/src/types/messages.ts` — добавлен sessionId в InitResponse
- [x] `chat-widget/src/utils/storage.ts` — saveSessionId/loadSessionId
- [x] `chat-widget/src/widget.ts` — сохраняет и передаёт sessionId
- [x] `chat-widget/src/transport/websocket.ts` — setSessionId(), encodeURIComponent в URL

### Тесты
- [x] `src/http/routes/__tests__/chat-cors.test.ts` — тесты cookie attributes (SameSite, Secure, Partitioned)

## Важно для разработчика

Порядок подключения виджета:
1. `POST /api/chat/init` → получаем `sessionId`
2. Сохраняем в localStorage через `saveSessionId()`
3. `wsClient.setSessionId(sessionId)`
4. `wsClient.connect()` → URL становится `wss://chat.../ws/chat?session=<uuid>`

Сервер проверяет sessionId в таком порядке:
1. Cookie (если браузер не блокирует)
2. Query parameter `?session=` (fallback)

## Тестирование

### Ожидаемое поведение по браузерам

| Браузер | Cookie | Query param | Результат |
|---------|--------|-------------|-----------|
| Chrome 114+ | ✅ SameSite=None + Partitioned | fallback | Работает |
| Firefox 115+ | ✅ SameSite=None | fallback | Работает |
| Edge | ✅ SameSite=None + Partitioned | fallback | Работает |
| Safari | ❌ Блокирует | ✅ Используется | Работает |

### Шаги проверки

1. Открыть браузер с Tracking Prevention (Edge/Safari)
2. Зайти на dellshop.ru
3. Открыть чат-виджет
4. Отправить сообщение — должно отправиться
5. Проверить Network tab — WebSocket URL содержит `?session=<uuid>`
