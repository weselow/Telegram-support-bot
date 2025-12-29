# TD-037: Widget Error Logger (мини-логгер ошибок)

**Дата:** 2025-12-29
**Приоритет:** Средний
**Сложность:** Средняя (2-3 часа)

## Проблема

Ошибки в chat-widget не логируются на сервер. Если у пользователя что-то не работает, мы об этом не узнаем.

Полноценный Sentry SDK добавит +15-40% к размеру виджета (72 KB → 85-100 KB).

## Решение

Создать легковесный мини-логгер (~1-2 KB), который отправляет ошибки на backend endpoint.

### Backend

Новый endpoint `POST /api/widget/errors`:
```typescript
{
  level: 'error' | 'warn',
  message: string,
  context: {
    sessionId?: string,
    userAgent: string,
    url: string,
    timestamp: string
  },
  stack?: string
}
```

Логи пишутся в существующий Sentry через `Sentry.captureMessage()` с тегом `source: widget`.

### Frontend (chat-widget)

Модуль `src/utils/error-logger.ts`:
- `logError(error: Error, context?: object)` — отправка ошибки
- `logWarning(message: string, context?: object)` — предупреждения
- Автоматический перехват: `window.onerror`, `unhandledrejection`
- Батчинг: накопление ошибок и отправка раз в 5 секунд
- Rate limiting: максимум 10 ошибок в минуту

### Какие ошибки логировать

| Событие | Уровень | Контекст |
|---------|---------|----------|
| WebSocket connection failed | error | code, reason |
| WebSocket unexpected close | warn | code, reason |
| HTTP 4xx/5xx | error | status, endpoint |
| Session not found (4001) | warn | — |
| JavaScript exception | error | stack |
| Network offline | warn | — |

## Файлы для создания/изменения

- [ ] `src/http/routes/widget-errors.ts` — новый endpoint
- [ ] `chat-widget/src/utils/error-logger.ts` — модуль логгера
- [ ] `chat-widget/src/widget.ts` — инициализация логгера
- [ ] `chat-widget/src/transport/websocket.ts` — логирование WS ошибок
- [ ] `chat-widget/src/transport/http.ts` — логирование HTTP ошибок

## Метрики успеха

- Размер виджета: +1-2 KB (не более 75 KB итого)
- Ошибки видны в Sentry с тегом `source: widget`
- Можно фильтровать по sessionId
