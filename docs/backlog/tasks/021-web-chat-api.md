# 021 - Web Chat API

**Статус:** TODO
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

### Фаза 1: База данных
- [ ] Миграция Prisma: `tgUserId` nullable
- [ ] Добавить поле `webSessionId` в User
- [ ] Добавить enum `MessageChannel` и поле `channel` в MessageMap
- [ ] Создать таблицу `web_link_tokens`

### Фаза 2: HTTP Endpoints
- [ ] `POST /api/chat/init` — инициализация сессии
- [ ] `GET /api/chat/history` — история сообщений
- [ ] `GET /api/chat/status` — статус тикета
- [ ] `POST /api/chat/link-telegram` — генерация ссылки для Telegram
- [ ] `POST /api/chat/close` — закрытие тикета

### Фаза 3: WebSocket
- [ ] Настроить `@fastify/websocket`
- [ ] Реализовать connection manager
- [ ] Обработчики событий: message, typing, close
- [ ] Keep-alive (ping/pong)

### Фаза 4: Интеграция с ботом
- [ ] Обработка `/start link_<token>` для связывания аккаунтов
- [ ] Модификация `supportMessageHandler` — отправка в WebSocket
- [ ] Префикс `[WEB]` для сообщений из веб-чата
- [ ] Копирование истории при миграции в Telegram

### Фаза 5: Тестирование
- [ ] Unit-тесты для WebChatService
- [ ] Integration-тесты для HTTP endpoints
- [ ] E2E тест: Web → Topic → Web

## Зависимости

```json
{
  "@fastify/websocket": "^10.0.0"
}
```

## Критерии готовности

- [ ] Пользователь может начать чат через веб без регистрации
- [ ] Сообщения доставляются в реальном времени (WebSocket)
- [ ] История сохраняется между сессиями (cookie)
- [ ] Можно перейти в Telegram с сохранением истории
- [ ] После связывания — оба канала работают параллельно
- [ ] Покрытие тестами ≥60%

## Связанные задачи

- Исходная идея: `docs/backlog/ideas/web-chat-integration.md`
- Виджет для сайта — отдельный проект (frontend)
