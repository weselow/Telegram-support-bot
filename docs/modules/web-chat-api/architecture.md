# Архитектура Web Chat API

## Концепция

Один пользователь может использовать **оба канала одновременно** (Web + Telegram). Все сообщения синхронизируются через единый топик в группе поддержки.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SUPPORT GROUP                               │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Topic: "Иван (web:abc123 / tg:307865745)"                  │   │
│  │                                                             │   │
│  │  [WEB] Иван: Здравствуйте, нужна помощь                    │   │
│  │  [TG]  Иван: Продолжаю с телефона                          │   │
│  │  Поддержка: Добрый день! Чем помочь?                       │   │
│  │  [WEB] Иван: Как оформить возврат?                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↑                                      │
└──────────────────────────────│──────────────────────────────────────┘
                               │
           ┌───────────────────┴───────────────────┐
           │          MESSAGE ROUTER               │
           │   (определяет источник/получателя)    │
           └───────────────────┬───────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│   WEB CHAT      │   │   TELEGRAM      │   │   SUPPORT       │
│   (Widget)      │   │   (Bot DM)      │   │   (Topic)       │
│                 │   │                 │   │                 │
│  WebSocket API  │   │  grammY Bot     │   │  grammY Bot     │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## Идентификация пользователя

### Session ID (Web)

```
Cookie: webchat_session=<UUID>
- HttpOnly: true (защита от XSS)
- Secure: true (только HTTPS)
- SameSite: Lax
- Max-Age: 31536000 (1 год)
- Синхронизируется через Chrome Sync
```

### Связывание каналов

Один User record может иметь:
- Только `webSessionId` — начал в веб-чате
- Только `tgUserId` — начал в Telegram
- **Оба** — связал каналы (после миграции или по /start с веб-сессией)

```typescript
// Пример User record с обоими каналами
{
  id: "uuid",
  webSessionId: "abc123-def456",  // Web идентификатор
  tgUserId: 307865745n,           // Telegram идентификатор
  tgUsername: "ivan_petrov",
  topicId: 42,                    // Единый топик
  status: "IN_PROGRESS"
}
```

## Потоки сообщений

### 1. Web → Support Group

```
User (Web Widget)
    │
    ▼ WebSocket: {type: "message", text: "..."}
    │
HTTP Server (Fastify + WS)
    │
    ▼ Найти/создать User по webSessionId
    │
Topic Service
    │
    ▼ bot.api.sendMessage(topicId, "[WEB] " + text)
    │
Support Group Topic
    │
    ▼ Сохранить в messages_map
    │
Database
```

### 2. Telegram → Support Group (существующий flow)

```
User (Telegram DM)
    │
    ▼ grammY: message event
    │
privateMessageHandler
    │
    ▼ mirrorUserMessage()
    │
Support Group Topic
```

### 3. Support → User (оба канала)

```
Support Group Topic
    │
    ▼ grammY: message event (supportMessageHandler)
    │
Message Router
    │
    ├─── tgUserId exists? ──► mirrorSupportMessage() → Telegram DM
    │
    └─── webSessionId exists? ──► WebSocket push → Web Widget
                                  (или сохранить для polling)
```

## WebSocket Protocol

### Подключение

```
wss://chat.dellshop.ru/ws/chat?session=<sessionId>
```

### События (Server → Client)

```typescript
// Новое сообщение
{
  type: "message",
  data: {
    id: "msg-uuid",
    text: "Текст сообщения",
    from: "support" | "user",
    channel: "web" | "telegram",
    timestamp: "2025-12-28T18:00:00Z"
  }
}

// Статус печати
{
  type: "typing",
  data: { isTyping: true }
}

// Статус тикета изменён
{
  type: "status",
  data: { status: "IN_PROGRESS" }
}

// Пользователь перешёл в Telegram
{
  type: "channel_linked",
  data: { telegram: "@username" }
}
```

### События (Client → Server)

```typescript
// Отправить сообщение
{
  type: "message",
  data: { text: "Текст сообщения" }
}

// Индикатор печати
{
  type: "typing",
  data: { isTyping: true }
}

// Закрыть тикет
{
  type: "close",
  data: { resolved: true }
}
```

## Миграция Web → Telegram

### Сценарий: Пользователь хочет продолжить в Telegram

1. **Web Widget:** Кнопка "Продолжить в Telegram"
2. **API:** `POST /api/chat/link-telegram` → возвращает `{ token, telegramUrl }`
3. **Redirect:** `https://t.me/dellshop_support_bot?start=link_<token>`
4. **Bot:** Получает `/start link_<token>`
5. **Bot:** Находит User по token, добавляет `tgUserId`
6. **Bot:** Копирует историю веб-чата в топик (опционально)
7. **WebSocket:** Отправляет `channel_linked` event

### После связывания

- Оба канала активны
- Сообщения из Web помечаются `[WEB]` в топике
- Сообщения из Telegram помечаются `[TG]` (или без пометки)
- Ответы поддержки доставляются в **оба** канала

## Хранение сообщений (Offline)

Если пользователь offline (нет WebSocket соединения):

1. Сообщения сохраняются в `messages_map` как обычно
2. При следующем подключении — `GET /api/chat/history?after=<lastMessageId>`
3. Или WebSocket отправит накопленные сообщения при reconnect

## Компоненты для реализации

### Новые файлы

```
src/
├── http/
│   ├── routes/
│   │   └── chat.ts              # REST endpoints
│   └── websocket/
│       ├── server.ts            # WebSocket сервер
│       ├── handlers.ts          # Обработчики WS событий
│       └── connections.ts       # Управление подключениями
├── services/
│   └── web-chat.service.ts      # Бизнес-логика веб-чата
└── types/
    └── web-chat.types.ts        # TypeScript типы
```

### Модификации существующих файлов

```
src/
├── services/
│   └── message.service.ts       # + отправка в WebSocket
├── bot/handlers/
│   ├── support.ts               # + отправка в Web
│   └── start.ts                 # + обработка link_<token>
└── db/repositories/
    └── user.repository.ts       # + findByWebSessionId
```

## Зависимости

```json
{
  "@fastify/websocket": "^10.0.0",  // WebSocket для Fastify
  "ws": "^8.0.0"                     // Базовая WS библиотека
}
```
