# Decisions: Web Chat API

## Контекст

Реализация API для веб-чата на сайте. Проектирование завершено ранее, документация в `docs/modules/web-chat-api/`.

## Принятые решения

### Архитектура
- WebSocket для real-time (Fastify + @fastify/websocket)
- Cookie-based session ID (`webchat_session`, 1 год TTL)
- Двухканальная синхронизация (Web + Telegram одновременно)
- Единый топик для всех сообщений пользователя

### Rate Limiting
- IP-based rate limit для HTTP endpoints
- Добавлена `checkKeyRateLimit` для гибкого rate limiting WebSocket сообщений

### Типы WebSocket сообщений
- Server → Client: connected, message, typing, status, channel_linked, error, ping
- Client → Server: message, typing, close, pong

## Что реализовано

### Фаза 1: База данных ✅
- [x] Миграция: `tgUserId` nullable
- [x] Поле `webSessionId` в User
- [x] Enum `MessageChannel` и поле `channel` в MessageMap
- [x] Таблица `web_link_tokens`
- [x] Обновлены хендлеры бота для поддержки nullable полей

### Фаза 2: HTTP Endpoints ✅
- [x] POST /api/chat/init
- [x] GET /api/chat/history
- [x] GET /api/chat/status
- [x] POST /api/chat/message
- [x] POST /api/chat/link-telegram
- [x] POST /api/chat/close
- [x] web-chat.service.ts - основная бизнес-логика
- [x] web-link-token.repository.ts - работа с токенами привязки

### Фаза 3: WebSocket ✅
- [x] @fastify/websocket setup
- [x] Connection manager с отслеживанием сессий
- [x] Event handlers для всех типов сообщений
- [x] Keep-alive ping/pong каждые 30 секунд
- [x] Cleanup неактивных подключений

### Фаза 4: Интеграция с ботом ✅
- [x] /start link_<token> - привязка Telegram к веб-сессии
- [x] supportMessageHandler → WebSocket отправка
- [x] Префикс [WEB] для сообщений из веб-чата
- [x] Уведомление веб-клиента о привязке Telegram

### Фаза 5: Тестирование
- [x] Существующие тесты (139) проходят
- [ ] Unit-тесты для web-chat.service (отложено как tech debt)
- [ ] Integration-тесты WebSocket (отложено как tech debt)

## Что НЕ реализовано

1. **Typing indicator в топик** - logging только на debug уровне
2. **Копирование истории в Telegram** - только синхронизация новых сообщений
3. **Дополнительные тесты** - вынесено в tech debt

## Технические детали

### Файловая структура
```
src/
├── http/
│   ├── routes/chat.ts        # HTTP endpoints
│   └── ws/
│       ├── types.ts          # TypeScript типы для WebSocket
│       ├── connection-manager.ts  # Менеджер подключений
│       ├── handler.ts        # Обработчики сообщений
│       └── websocket.ts      # Регистрация WebSocket
├── services/
│   └── web-chat.service.ts   # Бизнес-логика чата
└── db/repositories/
    └── web-link-token.repository.ts  # Токены привязки
```

### Ключевые изменения
- Prisma schema: User и MessageMap расширены для web
- Bot handlers: обновлены для nullable полей
- HTTP server: зарегистрированы chat routes и WebSocket
