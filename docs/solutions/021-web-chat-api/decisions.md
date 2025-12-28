# Decisions: Web Chat API

## Контекст

Реализация API для веб-чата на сайте. Проектирование завершено ранее, документация в `docs/modules/web-chat-api/`.

## Принятые решения

### Архитектура (из проектирования)
- WebSocket для real-time (Fastify + @fastify/websocket)
- Cookie-based session ID (`webchat_session`, 1 год TTL)
- Двухканальная синхронизация (Web + Telegram одновременно)
- Единый топик для всех сообщений пользователя

## Что реализовано

### Фаза 1: База данных ✅
- [x] Миграция: `tgUserId` nullable
- [x] Поле `webSessionId` в User
- [x] Enum `MessageChannel` и поле `channel` в MessageMap
- [x] Таблица `web_link_tokens`
- [x] Обновлены хендлеры бота для поддержки nullable полей

### Фаза 2: HTTP Endpoints
- [ ] POST /api/chat/init
- [ ] GET /api/chat/history
- [ ] GET /api/chat/status
- [ ] POST /api/chat/link-telegram
- [ ] POST /api/chat/close

### Фаза 3: WebSocket
- [ ] @fastify/websocket setup
- [ ] Connection manager
- [ ] Event handlers
- [ ] Keep-alive

### Фаза 4: Интеграция с ботом
- [ ] /start link_<token>
- [ ] supportMessageHandler → WebSocket
- [ ] Префикс [WEB]
- [ ] Копирование истории

### Фаза 5: Тестирование
- [ ] Unit-тесты
- [ ] Integration-тесты
- [ ] E2E тест

## Технические детали

(будут добавляться по мере реализации)
