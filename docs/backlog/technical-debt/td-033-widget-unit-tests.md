# TD-033: Chat Widget — Unit-тесты

**Приоритет:** Medium
**Статус:** В ожидании
**Модуль:** chat-widget

## Описание

Добавить unit-тесты для критических компонентов chat-widget.

## Приоритетные файлы для покрытия

| Файл | Критичность | Причина |
|------|-------------|---------|
| `utils/escape.ts` | High | XSS защита |
| `transport/websocket.ts` | High | Reconnect логика |
| `transport/http.ts` | Medium | HTTP клиент |
| `core/state.ts` | Medium | State management |
| `utils/storage.ts` | Low | localStorage |

## Что тестировать

### escape.ts
- `escapeHtml()` с опасными строками: `<script>`, `onclick=`, etc.
- `sanitizeInput()` — обрезка длины, нормализация whitespace
- `formatMessageText()` — URL парсинг

### websocket.ts
- Connect/disconnect
- Reconnect с exponential backoff
- Обработка server events
- Отправка когда не подключен

### http.ts
- Успешные запросы
- Ошибки 401, 429, 500
- Network failures

## Инфраструктура

Vitest уже настроен в `package.json`. Нужно:
1. Создать `__tests__/` папку
2. Mock для WebSocket API
3. Mock для fetch API

## Связанные файлы

- `chat-widget/package.json` — vitest настроен
- `chat-widget/src/utils/escape.ts`
- `chat-widget/src/transport/websocket.ts`
- `chat-widget/src/transport/http.ts`
