# Message Flow - Web Chat API

## Обзор

Документ описывает потоки сообщений между тремя точками:
1. **Chat Widget** — виджет на сайте (WebSocket)
2. **Telegram DM** — личные сообщения боту
3. **Тема поддержки** — тема (топик) в группе поддержки

Все имена функций и файлов в схемах ниже взяты из `src/` — если код меняется,
схему нужно поправить вместе с ним.

---

## 1. Web User → Support

### Сценарий: Пользователь пишет через веб-виджет

```
┌────────────────────────────┐
│  Chat Widget (браузер)     │
└──────────────┬─────────────┘
               │ WebSocket: {"type":"message","data":{"text":"Привет"}}
               ▼
┌────────────────────────────┐
│ http/ws/handler.ts         │
│ handleWebSocketMessage()   │
└──────────────┬─────────────┘
               │ 1. Проверить формат, длину (до 4000) и частоту
               ▼
┌────────────────────────────┐
│ services/web-chat.service  │
│ sendMessage()              │
└──────────────┬─────────────┘
               │ 2. Найти пользователя по webSessionId
               │ 3. Найти или создать тему (ensureTopic)
               ▼
┌────────────────────────────┐
│ bot.api.sendMessage()      │
│ (grammy)                   │
└──────────────┬─────────────┘
               │ 4. Текст с префиксом [WEB] в тему группы
               ▼
┌────────────────────────────┐
│  Тема поддержки (Telegram) │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ messageRepository          │
│ .createWebMessage()        │
└────────────────────────────┘
               │ 5. Запись в messages_map:
               │    userId, topicMessageId,
               │    direction: USER_TO_SUPPORT,
               │    channel: WEB, text
```

После записи в базу обработчик подтверждает отправку самому виджету:
`sendToSession(sessionId, 'message', ...)` из `http/ws/connection-manager.ts`.

Тот же `sendMessage()` вызывается из HTTP-маршрута `POST /api/chat/message`
(`http/routes/chat.ts`) — это запасной путь, когда WebSocket недоступен.
Файлы идут через `POST /api/chat/upload` → `sendFile()` в том же сервисе.

### Формат сообщения в теме

```
[WEB] Привет, нужна помощь с заказом
```

Префикс `[WEB]` указывает что сообщение пришло из веб-чата.

### Создание темы под нагрузкой

Сообщение и файл могут прийти почти одновременно, поэтому создание темы идёт под
блокировкой в Redis (`lock:topic:{userId}`, срок жизни 15 секунд). Захвативший
блокировку перечитывает обращение из базы и создаёт тему; остальные ждут
освобождения и получают уже готовый идентификатор темы. Если Redis недоступен,
блокировка не берётся, но перечитывание из базы остаётся — в журнал пишется
предупреждение.

### Смена статуса обращения

Сообщение или файл из виджета проходит ту же цепочку статусов, что и сообщение
из Telegram (`bot/handlers/message.ts`):

| Статус до сообщения | Что происходит |
|---------------------|----------------|
| `CLOSED` | Обращение переоткрывается (`CLIENT_REOPEN` → `NEW`), в тему уходит уведомление, старые SLA-таймеры снимаются и заводятся заново |
| `WAITING_CLIENT` | Снимается таймер автозакрытия, статус меняется на `IN_PROGRESS` (`CLIENT_REPLY`) |
| `NEW`, `IN_PROGRESS` | Статус не меняется |

Переоткрытие выполняется **до** отправки сообщения в тему, смена на `IN_PROGRESS` —
**после** успешной отправки. Web-клиент узнаёт о новом статусе через WebSocket-событие
`status`.

Закрытие обращения из виджета (`POST /api/chat/close`, WebSocket `close`) идёт через тот
же сервис статусов (`CLIENT_RESOLVED`), поэтому попадает в журнал событий обращения и
обновляет карточку тикета.

---

## 2. Telegram User → Support

### Сценарий: Пользователь пишет в Telegram DM

```
┌────────────────────────────┐
│  Telegram DM               │
│  (пользователь)            │
└──────────────┬─────────────┘
               │ grammy: on('message') + фильтр по типу чата
               ▼
┌────────────────────────────┐
│ bot/handlers/message.ts    │
│ privateMessageHandler()    │
└──────────────┬─────────────┘
               │ 1. Проверить частоту (checkRateLimit)
               │ 2. Отдать сообщение онбордингу, если он идёт
               │ 3. findUserByTgId(tgUserId);
               │    нет пользователя или темы → онбординг
               ▼
┌────────────────────────────┐
│ services/message.service   │
│ mirrorUserMessage()        │
└──────────────┬─────────────┘
               │ 4. Копия сообщения в тему группы
               ▼
┌────────────────────────────┐
│  Тема поддержки (Telegram) │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ messageRepository.create() │
└────────────────────────────┘
               │ 5. Запись в messages_map:
               │    userId, dmMessageId, topicMessageId,
               │    direction: USER_TO_SUPPORT,
               │    channel: TELEGRAM (значение по умолчанию)
```

`messageRepository.create()` сохраняет только связку идентификаторов сообщений —
текст в эту запись не пишется, он остаётся в самом Telegram.

### Формат сообщения в теме

```
Привет, нужна помощь с заказом
```

Без префикса. Если у пользователя связаны оба канала (`user.webSessionId` заполнен),
`privateMessageHandler` передаёт `mirrorUserMessage` признак `channelPrefix: 'TG'`,
и текстовое сообщение уходит в тему как `[TG] Привет, нужна помощь с заказом`.

---

## 3. Support → User (оба канала)

### Сценарий: Сотрудник отвечает в теме

Промежуточного маршрутизатора нет: `supportMessageHandler` сам определяет,
какие каналы есть у пользователя, и вызывает нужные функции.

```
┌────────────────────────────┐
│  Тема поддержки            │
│  (ответ сотрудника)        │
└──────────────┬─────────────┘
               │ grammy: on('message') + фильтр по SUPPORT_GROUP_ID
               ▼
┌────────────────────────────┐
│ bot/handlers/support.ts    │
│ supportMessageHandler()    │
└──────────────┬─────────────┘
               │ 1. Пропустить внутренние (// и #internal)
               │ 2. findUserByTopicId(topicId)
               │ 3. Проверить каналы пользователя
               │
       ┌───────┴────────────────┐
       │                        │
 user.tgUserId есть?      user.webSessionId есть?
       ▼                        ▼
┌───────────────────┐   ┌────────────────────────┐
│ services/         │   │ messageRepository      │
│ message.service   │   │ .createWebMessage()    │
│ mirrorSupport     │   │           ↓            │
│ Message()         │   │ http/ws/               │
│                   │   │ connection-manager     │
│                   │   │ sendToUser()           │
└─────────┬─────────┘   └───────────┬────────────┘
          ▼                         ▼
┌───────────────────┐   ┌────────────────────────┐
│ Telegram DM       │   │ Chat Widget            │
│ (пользователь)    │   │ (браузер)              │
└───────────────────┘   └────────────────────────┘
```

После доставки в оба канала обработчик снимает SLA-таймеры
(`cancelAllSlaTimers`) и меняет статус: `autoChangeStatus(api, user, 'SUPPORT_REPLY')`.

### Важно: доставка в оба канала

Если у пользователя связаны Web и Telegram, ответ поддержки уходит в оба канала —
последовательно, в одном блоке `try`:

```typescript
// src/bot/handlers/support.ts, supportMessageHandler
if (user.tgUserId) {
  await mirrorSupportMessage(ctx.api, ctx.message, user.id, user.tgUserId);
}

if (user.webSessionId) {
  const savedMessage = await messageRepository.createWebMessage({
    userId: user.id,
    topicMessageId: ctx.message.message_id,
    direction: 'SUPPORT_TO_USER',
    channel: 'TELEGRAM',
    text: msgText || placeholderText,
    mediaFileId,
    mediaDuration: voiceDuration,
  });

  sendToUser(user.id, 'message', {
    id: savedMessage.id,
    text: msgText,
    from: 'support',
    channel: 'telegram',
    timestamp: savedMessage.createdAt.toISOString(),
  });
}
```

Что важно понимать из этого фрагмента:

- ветка веб-чата **сначала пишет сообщение в историю**, и только потом отдаёт его
  в соединение. `sendToUser` возвращает `false`, если живого соединения нет, —
  сообщение при этом уже сохранено и будет получено при переподключении
  (см. раздел 6);
- вложения превращаются в ссылки на собственный прокси `/api/media/{file_id}` —
  токен бота наружу не отдаётся;
- для пользователя со связанными каналами один ответ поддержки даёт **две** записи
  в `messages_map`: связку идентификаторов из `mirrorSupportMessage` (без текста) и
  запись с текстом из `createWebMessage`.

---

## 4. Миграция Web → Telegram

### Сценарий: Пользователь нажимает "Продолжить в Telegram"

```
┌────────────────────────────┐
│  Chat Widget (браузер)     │
│  [кнопка Telegram]         │
└──────────────┬─────────────┘
               │ Нажатие "Продолжить в Telegram"
               ▼
┌────────────────────────────┐
│ POST /api/chat/            │
│      link-telegram         │
└──────────────┬─────────────┘
               │ services/web-chat.service → linkTelegram()
               ▼
┌────────────────────────────┐
│ webLinkTokenRepository     │
│ .create(userId)            │
└──────────────┬─────────────┘
               │ 1. Токен вида link_<32 hex>, срок жизни 1 час
               │ 2. Запись в web_link_tokens
               │ 3. Ответ: {token, telegramUrl, expiresAt}
               ▼
┌────────────────────────────┐
│ https://t.me/<BOT_USERNAME>│
│ ?start=link_<32 hex>       │
└──────────────┬─────────────┘
               │ Пользователь открывает ссылку
               ▼
┌────────────────────────────┐
│ bot/handlers/start.ts      │
│ startHandler()             │
│ → handleLinkToken()        │
└──────────────┬─────────────┘
               │ services/web-chat.service → processLinkToken()
               │ 1. findValidByToken — не истёк и не использован
               │ 2. markUsed
               │ 3. linkTelegramAccount: tgUserId в ту же запись users
               ▼
┌────────────────────────────┐
│ connection-manager         │
│ sendToUser(..., 'channel_  │
│ linked', ...)              │
└────────────────────────────┘
               │ 4. Виджет узнаёт о связывании
               │ 5. В Telegram уходят приветствие и запрос телефона
```

История в тему **не копируется**: Telegram-идентификатор дописывается в ту же запись
`users`, у которой уже есть `topicId`, поэтому переписка изначально лежит в одной теме.
Поле `historyCopied` в событии `channel_linked` сейчас всегда `true`.

Имя темы после связывания не меняется. Тема, созданная из виджета, называется
`Web: <первые 8 символов сессии>` (`web-chat.service.ts`), тема, созданная из Telegram, —
`<Имя> (<tgUserId>)` (`topic.service.ts`, `formatTopicName`).

### После связывания

```typescript
// Запись users теперь содержит оба идентификатора
{
  id: "user-uuid",
  webSessionId: "abc123-def456",  // Web
  tgUserId: 307865745n,           // Telegram
  topicId: 42                     // Единая тема
}
```

---

## 5. Синхронизация между каналами

### Сценарий: Пользователь пишет то в Web, то в Telegram

```
Хронология:
─────────────────────────────────────────────────────────────►

[WEB] 10:00  "Здравствуйте"
        │
        └──► Тема: "[WEB] Здравствуйте"

[TG]  10:01  "Продолжаю с телефона"
        │
        └──► Тема: "[TG] Продолжаю с телефона"

[SUPP] 10:02 "Добрый день!"
        │
        ├──► Telegram DM: "Добрый день!"
        └──► Chat Widget: "Добрый день!"

[WEB] 10:03  "Как оформить возврат?"
        │
        └──► Тема: "[WEB] Как оформить возврат?"
```

### Вид темы в группе поддержки

```
┌─────────────────────────────────────────────────────┐
│  Тема: "Web: abc12345"                              │
├─────────────────────────────────────────────────────┤
│  [WEB] Здравствуйте                                 │
│  [TG] Продолжаю с телефона                          │
│  Поддержка: Добрый день!                            │
│  [WEB] Как оформить возврат?                        │
└─────────────────────────────────────────────────────┘
```

---

## 6. Offline Message Delivery

### Сценарий: Web-пользователь offline, поддержка отвечает

```
┌────────────────────────────┐
│  Тема поддержки            │
│  (ответ сотрудника)        │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ bot/handlers/support.ts    │
│ supportMessageHandler()    │
└──────────────┬─────────────┘
               │ 1. messageRepository.createWebMessage() —
               │    сообщение попадает в messages_map всегда
               │ 2. sendToUser(...)
               │
               ├── соединение есть ──► отдаётся сразу, вернёт true
               │
               └── соединения нет ──► вернёт false, сообщение
                                       остаётся только в базе

┌─────────────────────────────────────────────────────┐
│  При переподключении:                                │
│                                                      │
│  1. Виджет открывает /ws/chat                        │
│  2. GET /api/chat/history?after=<lastMessageId>      │
│  3. Возвращаются сообщения, пришедшие после разрыва  │
│  4. Виджет показывает пропущенное                    │
└─────────────────────────────────────────────────────┘
```

Соединения, молчавшие дольше 5 минут, закрываются по расписанию
(`cleanupInactiveConnections` в `connection-manager.ts`), поэтому длинный простой
всегда заканчивается переподключением и дозагрузкой истории.

---

## 7. Typing Indicators

### Web → Тема поддержки

```
Chat Widget                   Тема поддержки
    │                              │
    │ {"type":"typing",            │
    │  "data":{"isTyping":true}}   │
    │─────────────────────────────►│ бот показывает "печатает"
    │                              │
```

`handleTyping` в `http/ws/handler.ts` пересылает признак только при
`isTyping: true` и вызывает `bot.api.sendChatAction(SUPPORT_GROUP_ID, 'typing',
{ message_thread_id })`. Telegram сам гасит индикатор через несколько секунд,
отдельного сообщения о прекращении печати нет.

### Support → Chat Widget

Нет и не планируется. Telegram не сообщает боту, что сотрудник набирает текст в
теме, — источника данных для индикатора не существует. Поэтому в направлении
сервер → виджет типа `typing` нет ни в `http/ws/types.ts`, ни в виджете.

---

## Error Handling

### Разрыв WebSocket

`http/ws/websocket.ts` снимает соединение с учёта и при штатном закрытии, и при
ошибке:

```typescript
socket.on('close', (code: number, reason: Buffer) => {
  removeConnection(sessionId);
  logger.info({ sessionId, code, reason: reason.toString() }, 'WebSocket client disconnected');
});

socket.on('error', (error: Error) => {
  logger.error({ error, sessionId }, 'WebSocket error');
  removeConnection(sessionId);
});
```

Сообщения при этом остаются в `messages_map` и подтягиваются при переподключении
через `GET /api/chat/history`.

### Сбой доставки ответа поддержки

Весь блок доставки в `supportMessageHandler` обёрнут в один `try/catch`. В `catch`
ошибка уходит в Sentry через `captureError`, а сотруднику отвечают прямо в теме:

```typescript
// src/bot/handlers/support.ts
catch (error) {
  captureError(error, { topicId, userId: user.id, action: 'mirrorSupportMessage' });

  if (isBotBlockedError(error)) {
    // GrammyError, код 403, описание содержит 'blocked by the user'
    logger.warn({ topicId, userId: user.id }, 'Bot blocked by user');
    await ctx.reply(messages.support.botBlocked, { message_thread_id: topicId });
  } else {
    logger.error({ error, topicId, userId: user.id }, 'Failed to mirror support message');
    await ctx.reply(messages.support.deliveryFailed, { message_thread_id: topicId });
  }
}
```

Отдельной пометки «бот заблокирован» в базе нет — сотрудник узнаёт об этом только
из сообщения в теме.
