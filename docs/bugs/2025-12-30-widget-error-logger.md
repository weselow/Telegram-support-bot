# Widget Error Logger (TD-037)

**Дата:** 2025-12-30
**Источник:** TD-037

## Проблема

Ошибки в chat-widget не логировались на сервер. При сбоях у пользователей (WebSocket disconnect, HTTP ошибки, JS exceptions) — не было никакой видимости для диагностики.

Полноценный Sentry SDK добавил бы +15-40 KB к размеру бандла виджета.

## Решение

Создан легковесный error logger (~1.5 KB), который:
- Перехватывает `window.onerror` и `unhandledrejection`
- Батчит ошибки и отправляет раз в 5 секунд
- Применяет rate limiting (10 ошибок/минуту)
- Отправляет на backend endpoint `/api/widget/errors`
- Backend проксирует в Sentry с тегом `source: widget`

## Изменённые файлы

### Backend

- `src/config/sentry.ts` — добавлена функция `captureMessage()` для отправки сообщений в Sentry с тегами
- `src/http/routes/widget-errors.ts` — новый endpoint `POST /api/widget/errors`
- `src/http/server.ts` — регистрация нового route

### Frontend (chat-widget)

- `src/utils/error-logger.ts` — модуль логгера (singleton)
- `src/widget.ts` — инициализация и cleanup логгера
- `src/transport/websocket.ts` — логирование WebSocket ошибок
- `src/transport/http.ts` — логирование HTTP ошибок и session recovery

### Тесты

- `src/http/routes/__tests__/widget-errors.test.ts` — 12 тестов
- `chat-widget/src/__tests__/utils/error-logger.test.ts` — 13 тестов
- Обновлены `http.test.ts` и `websocket.test.ts` — mock errorLogger

## Что логируется

| Событие | Уровень | Контекст |
|---------|---------|----------|
| WebSocket connection failed | error | source: websocket |
| WebSocket unexpected close | warn | code, reason |
| HTTP 4xx/5xx (кроме 401) | error | endpoint, status |
| HTTP 429 rate limit | warn | endpoint, status |
| Session recovery (401) | warn | endpoint |
| JavaScript exception | error | stack |

## API Endpoint

```
POST /api/widget/errors
Content-Type: application/json

{
  "errors": [
    {
      "level": "error" | "warn",
      "message": "Error message",
      "context": {
        "sessionId": "abc-123",
        "userAgent": "...",
        "url": "https://...",
        "timestamp": "2025-12-30T12:00:00Z"
      },
      "stack": "Error: ...\n    at ..."
    }
  ]
}
```

**Ограничения:**
- Максимум 10 ошибок за запрос
- Сообщения обрезаются до 1000 символов
- CORS: только разрешённые домены

## Важно для разработчика

1. **Инициализация логгера** происходит в `ChatWidget` конструкторе с `apiUrl`
2. **sessionId** устанавливается после успешного `init()` для привязки ошибок к сессии
3. **Cleanup** вызывается в `destroy()` — flush оставшихся ошибок и снятие global handlers
4. В Sentry ошибки виджета можно найти по тегу `source:widget`
5. Rate limiting на фронте защищает от flood при каскадных ошибках
