# Message Flow - Web Chat API

## Обзор

Документ описывает потоки сообщений между тремя точками:
1. **Web Widget** — виджет на сайте (WebSocket)
2. **Telegram DM** — личные сообщения боту
3. **Support Topic** — топик в группе поддержки

---

## 1. Web User → Support

### Сценарий: Пользователь пишет через веб-виджет

```
┌─────────────────┐
│   Web Widget    │
│   (Browser)     │
└────────┬────────┘
         │ WebSocket: {type: "message", data: {text: "Привет"}}
         ▼
┌─────────────────┐
│  WebSocket      │
│  Handler        │
└────────┬────────┘
         │ 1. Validate session
         │ 2. Parse message
         ▼
┌─────────────────┐
│  WebChatService │
│  .sendMessage() │
└────────┬────────┘
         │ 3. Find/create user by webSessionId
         │ 4. Find/create topic
         ▼
┌─────────────────┐
│  Telegram Bot   │
│  .sendMessage() │
└────────┬────────┘
         │ bot.api.sendMessage(topicId, "[WEB] Привет")
         ▼
┌─────────────────┐
│  Support Topic  │
│  (Telegram)     │
└────────┬────────┘
         │ 5. Message delivered
         ▼
┌─────────────────┐
│  MessageMap     │
│  .create()      │
└─────────────────┘
         │ 6. Save mapping:
         │    - userId
         │    - text
         │    - channel: WEB
         │    - topicMessageId
```

### Формат сообщения в топике

```
[WEB] Привет, нужна помощь с заказом
```

Префикс `[WEB]` указывает что сообщение пришло из веб-чата.

---

## 2. Telegram User → Support

### Сценарий: Пользователь пишет в Telegram DM (существующий flow)

```
┌─────────────────┐
│  Telegram DM    │
│  (User)         │
└────────┬────────┘
         │ grammY: message event
         ▼
┌─────────────────┐
│  privateMessage │
│  Handler        │
└────────┬────────┘
         │ 1. Find/create user
         │ 2. Find/create topic
         ▼
┌─────────────────┐
│  mirrorUser     │
│  Message()      │
└────────┬────────┘
         │ Copy message to topic
         ▼
┌─────────────────┐
│  Support Topic  │
│  (Telegram)     │
└────────┬────────┘
         │ 3. Save to MessageMap
         │    - channel: TELEGRAM
```

### Формат сообщения в топике

```
Привет, нужна помощь с заказом
```

Без префикса (или с `[TG]` если оба канала связаны).

---

## 3. Support → User (оба канала)

### Сценарий: Сотрудник отвечает в топике

```
┌─────────────────┐
│  Support Topic  │
│  (Staff Reply)  │
└────────┬────────┘
         │ grammY: message event (supportMessageHandler)
         ▼
┌─────────────────┐
│  MessageRouter  │
│  .route()       │
└────────┬────────┘
         │ 1. Get user by topicId
         │ 2. Check channels
         │
         ├─────────────────────────────────────┐
         │ tgUserId exists?                    │ webSessionId exists?
         ▼                                     ▼
┌─────────────────┐                   ┌─────────────────┐
│  mirrorSupport  │                   │  WebSocketMgr   │
│  Message()      │                   │  .broadcast()   │
└────────┬────────┘                   └────────┬────────┘
         │                                     │
         ▼                                     ▼
┌─────────────────┐                   ┌─────────────────┐
│  Telegram DM    │                   │  Web Widget     │
│  (User)         │                   │  (Browser)      │
└─────────────────┘                   └─────────────────┘
```

### Важно: Доставка в оба канала

Если пользователь связал Web + Telegram, ответ поддержки доставляется в **оба** канала одновременно:

```typescript
async routeSupportMessage(topicId: number, message: Message) {
  const user = await userRepository.findByTopicId(topicId)

  const promises: Promise<void>[] = []

  // Telegram DM (если есть)
  if (user.tgUserId) {
    promises.push(this.sendToTelegram(user.tgUserId, message))
  }

  // Web Widget (если есть активное соединение)
  if (user.webSessionId) {
    promises.push(this.sendToWebSocket(user.webSessionId, message))
  }

  await Promise.all(promises)
}
```

---

## 4. Миграция Web → Telegram

### Сценарий: Пользователь нажимает "Продолжить в Telegram"

```
┌─────────────────┐
│  Web Widget     │
│  [Telegram btn] │
└────────┬────────┘
         │ Click "Продолжить в Telegram"
         ▼
┌─────────────────┐
│  POST /api/chat │
│  /link-telegram │
└────────┬────────┘
         │ 1. Generate token
         │ 2. Save to web_link_tokens
         │ 3. Return deep link
         ▼
┌─────────────────┐
│  Response:      │
│  {telegramUrl}  │
└────────┬────────┘
         │ User clicks link
         ▼
┌─────────────────┐
│  t.me/bot?start │
│  =link_<token>  │
└────────┬────────┘
         │ Opens Telegram
         ▼
┌─────────────────┐
│  Bot receives   │
│  /start link_X  │
└────────┬────────┘
         │ 1. Validate token
         │ 2. Find User by token
         │ 3. Add tgUserId to User
         │ 4. Mark token used
         ▼
┌─────────────────┐
│  Copy History   │
│  (optional)     │
└────────┬────────┘
         │ Copy web messages to topic
         ▼
┌─────────────────┐
│  WebSocket:     │
│  channel_linked │
└─────────────────┘
         │ Notify web widget
```

### После связывания

```typescript
// User record теперь содержит оба идентификатора
{
  id: "user-uuid",
  webSessionId: "abc123-def456",  // Web
  tgUserId: 307865745n,           // Telegram
  topicId: 42                     // Единый топик
}
```

---

## 5. Синхронизация между каналами

### Сценарий: Пользователь пишет то в Web, то в Telegram

```
Timeline:
─────────────────────────────────────────────────────────────►

[WEB] 10:00  "Здравствуйте"
        │
        └──► Topic: "[WEB] Здравствуйте"

[TG]  10:01  "Продолжаю с телефона"
        │
        └──► Topic: "Продолжаю с телефона"

[SUPP] 10:02 "Добрый день!"
        │
        ├──► Telegram DM: "Добрый день!"
        └──► Web Widget:  "Добрый день!"

[WEB] 10:03  "Как оформить возврат?"
        │
        └──► Topic: "[WEB] Как оформить возврат?"
```

### Вид топика в группе поддержки

```
┌─────────────────────────────────────────────────────┐
│  Topic: "Иван (web:abc123 / tg:307865745)"          │
├─────────────────────────────────────────────────────┤
│  [WEB] Иван: Здравствуйте                           │
│  Иван: Продолжаю с телефона                         │
│  Поддержка: Добрый день!                            │
│  [WEB] Иван: Как оформить возврат?                  │
└─────────────────────────────────────────────────────┘
```

---

## 6. Offline Message Delivery

### Сценарий: Web-пользователь offline, поддержка отвечает

```
┌─────────────────┐
│  Support Topic  │
│  (Staff Reply)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  MessageRouter  │
└────────┬────────┘
         │ Check WebSocket connection
         │
         ├── Connected? ──► Send immediately
         │
         └── Disconnected? ──► Save to MessageMap
                              (will be fetched on reconnect)

┌─────────────────────────────────────────────────────┐
│  On Reconnect:                                       │
│                                                      │
│  1. WebSocket connected                              │
│  2. GET /api/chat/history?after=<lastMessageId>     │
│  3. Return all messages since disconnect             │
│  4. Widget displays missed messages                  │
└─────────────────────────────────────────────────────┘
```

---

## 7. Typing Indicators

### Web → Support Topic

```
Web Widget                    Support Topic
    │                              │
    │ typing: true                 │
    │─────────────────────────────►│ [WEB] Иван печатает...
    │                              │
    │ typing: false                │
    │─────────────────────────────►│ (indicator removed)
    │                              │
```

### Support → Web Widget

```
Support Topic                 Web Widget
    │                              │
    │ (staff typing detected)      │
    │─────────────────────────────►│ "Поддержка печатает..."
    │                              │
```

**Note:** Telegram не предоставляет typing events от пользователей в группах,
поэтому индикатор печати поддержки реализуется через отслеживание активности.

---

## Error Handling

### WebSocket Disconnect

```typescript
ws.on('close', async () => {
  // 1. Remove from active connections
  connectionManager.remove(sessionId)

  // 2. Messages will be stored in DB
  // 3. User can fetch on reconnect via /api/chat/history
})
```

### Message Delivery Failure

```typescript
async sendToTelegram(tgUserId: bigint, message: Message) {
  try {
    await bot.api.sendMessage(tgUserId, message.text)
  } catch (error) {
    if (error.code === 403) {
      // User blocked the bot
      await userRepository.markTelegramBlocked(tgUserId)
    }
    // Log error but don't fail the whole operation
    logger.error('Failed to send to Telegram', { tgUserId, error })
  }
}
```
