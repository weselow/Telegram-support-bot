# 021 - Web Chat API

**Статус:** DONE
**Приоритет:** Высокий
**Оценка:** Крупная задача (несколько дней)

## Описание

Реализация API для веб-чата на сайте. Позволяет пользователям общаться с поддержкой через виджет на сайте, с возможностью синхронизации с Telegram.

## Документация

Проектирование завершено, см. `docs/modules/web-chat-api/`:
- [README.md](../../modules/web-chat-api/README.md) — обзор
- [architecture.md](../../modules/web-chat-api/architecture.md) — архитектура
- [api-spec.md](../../modules/web-chat-api/api-spec.md) — спецификация API
- [database-changes.md](../../modules/web-chat-api/database-changes.md) — изменения БД
- [message-flow.md](../../modules/web-chat-api/message-flow.md) — потоки сообщений
- [widget-developer-guide.md](../../modules/web-chat-api/widget-developer-guide.md) — руководство для разработчика виджета

## Ключевые решения

- **WebSocket** для real-time доставки сообщений
- **Cookie-based session** (`webchat_session`, 1 год TTL)
- **Двухканальная синхронизация** — пользователь может использовать Web + Telegram одновременно
- **Единый топик** — все сообщения идут в один топик группы поддержки

## Подзадачи

### Фаза 1: База данных ✅
- [x] Миграция Prisma: `tgUserId` nullable
- [x] Добавить поле `webSessionId` в User
- [x] Добавить enum `MessageChannel` и поле `channel` в MessageMap
- [x] Создать таблицу `web_link_tokens`

### Фаза 2: HTTP Endpoints ✅
- [x] `POST /api/chat/init` — инициализация сессии
- [x] `GET /api/chat/history` — история сообщений
- [x] `GET /api/chat/status` — статус тикета
- [x] `POST /api/chat/message` — отправка сообщения
- [x] `POST /api/chat/link-telegram` — генерация ссылки для Telegram
- [x] `POST /api/chat/close` — закрытие тикета

### Фаза 3: WebSocket ✅
- [x] Настроить `@fastify/websocket`
- [x] Реализовать connection manager
- [x] Обработчики событий: message, typing, close
- [x] Keep-alive (ping/pong)

### Фаза 4: Интеграция с ботом ✅
- [x] Обработка `/start link_<token>` для связывания аккаунтов
- [x] Модификация `supportMessageHandler` — отправка в WebSocket
- [x] Префикс `[WEB]` для сообщений из веб-чата
- [ ] Копирование истории при миграции в Telegram (отложено)

### Фаза 5: Тестирование
- [x] Существующие тесты проходят (139 тестов)
- [ ] Unit-тесты для WebChatService (tech debt)
- [ ] Integration-тесты для HTTP endpoints (tech debt)
- [ ] E2E тест: Web → Topic → Web (tech debt)

## Зависимости

```json
{
  "@fastify/websocket": "^11.2.0"
}
```

## Критерии готовности

- [x] Пользователь может начать чат через веб без регистрации
- [x] Сообщения доставляются в реальном времени (WebSocket)
- [x] История сохраняется между сессиями (cookie)
- [x] Можно перейти в Telegram с сохранением истории
- [x] После связывания — оба канала работают параллельно
- [ ] Покрытие тестами ≥60% (tech debt)

## Связанные задачи

- Исходная идея: `docs/backlog/ideas/web-chat-integration.md`
- Виджет для сайта — отдельный проект (frontend)
