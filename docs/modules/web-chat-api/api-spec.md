# Web Chat API Specification

## Base URL

```
Production: https://chat.dellshop.ru
```

## HTTP Endpoints

### 1. Инициализация сессии

```http
POST /api/chat/init
Content-Type: application/json
```

**Request Body:**
```json
{
  "fingerprint": "optional-browser-fingerprint"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc123-def456-...",
    "isNewSession": true,
    "hasHistory": false,
    "telegramLinked": false
  }
}
```

**Cookies Set:**
```
Set-Cookie: webchat_session=abc123-def456-...;
  HttpOnly;
  Secure;
  SameSite=Lax;
  Max-Age=31536000;
  Path=/
```

**Notes:**
- Если cookie `webchat_session` уже существует — возвращает существующую сессию
- Создаёт User record в БД если не существует
- `hasHistory: true` если есть предыдущие сообщения

---

### 2. Получение истории сообщений

```http
GET /api/chat/history?limit=50&before=<messageId>
Cookie: webchat_session=<sessionId>
```

**Query Parameters:**
| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| limit | number | 50 | Количество сообщений (max 100) |
| before | string | - | ID сообщения для пагинации |
| after | string | - | ID сообщения (для новых после reconnect) |

**Response:**
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg-uuid-1",
        "text": "Здравствуйте, нужна помощь",
        "from": "user",
        "channel": "web",
        "timestamp": "2025-12-28T18:00:00Z"
      },
      {
        "id": "msg-uuid-2",
        "text": "Добрый день! Чем могу помочь?",
        "from": "support",
        "channel": "telegram",
        "timestamp": "2025-12-28T18:01:00Z"
      }
    ],
    "hasMore": true,
    "oldestId": "msg-uuid-1"
  }
}
```

---

### 3. Отправка сообщения (fallback без WebSocket)

```http
POST /api/chat/message
Cookie: webchat_session=<sessionId>
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "Текст сообщения",
  "replyTo": "msg-uuid-optional"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "msg-uuid-new",
    "timestamp": "2025-12-28T18:05:00Z"
  }
}
```

**Notes:**
- Используется если WebSocket недоступен
- Рекомендуется использовать WebSocket для real-time

---

### 4. Получение статуса тикета

```http
GET /api/chat/status
Cookie: webchat_session=<sessionId>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticketId": "ticket-uuid",
    "status": "IN_PROGRESS",
    "telegramLinked": true,
    "telegramUsername": "@ivan_petrov",
    "createdAt": "2025-12-28T17:55:00Z",
    "lastMessageAt": "2025-12-28T18:05:00Z"
  }
}
```

---

### 5. Генерация ссылки для перехода в Telegram

```http
POST /api/chat/link-telegram
Cookie: webchat_session=<sessionId>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "link_abc123xyz",
    "telegramUrl": "https://t.me/dellshop_support_bot?start=link_abc123xyz",
    "expiresAt": "2025-12-28T19:05:00Z"
  }
}
```

**Notes:**
- Token действителен 1 час
- После перехода по ссылке бот связывает Telegram аккаунт с веб-сессией
- История сообщений копируется в топик (опционально)

---

### 6. Закрытие тикета

```http
POST /api/chat/close
Cookie: webchat_session=<sessionId>
Content-Type: application/json
```

**Request Body:**
```json
{
  "resolved": true,
  "feedback": "Спасибо за помощь!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticketId": "ticket-uuid",
    "status": "CLOSED",
    "closedAt": "2025-12-28T18:30:00Z"
  }
}
```

---

## WebSocket API

### Подключение

```
wss://chat.dellshop.ru/ws/chat
Cookie: webchat_session=<sessionId>
```

**Или через query parameter (fallback):**
```
wss://chat.dellshop.ru/ws/chat?session=<sessionId>
```

### Handshake Response

После успешного подключения сервер отправляет:

```json
{
  "type": "connected",
  "data": {
    "sessionId": "abc123-def456",
    "ticketStatus": "NEW",
    "unreadCount": 0
  }
}
```

---

## WebSocket Events

### Server → Client

#### message
Новое сообщение в чате.

```json
{
  "type": "message",
  "data": {
    "id": "msg-uuid",
    "text": "Текст сообщения",
    "from": "support",
    "channel": "telegram",
    "timestamp": "2025-12-28T18:10:00Z",
    "replyTo": "msg-uuid-original"
  }
}
```

#### typing
Индикатор печати от поддержки.

```json
{
  "type": "typing",
  "data": {
    "isTyping": true
  }
}
```

#### status
Изменение статуса тикета.

```json
{
  "type": "status",
  "data": {
    "status": "IN_PROGRESS",
    "assignedTo": "Иван"
  }
}
```

#### channel_linked
Telegram аккаунт успешно привязан.

```json
{
  "type": "channel_linked",
  "data": {
    "telegram": "@ivan_petrov",
    "historyCopied": true
  }
}
```

#### error
Ошибка обработки запроса.

```json
{
  "type": "error",
  "data": {
    "code": "RATE_LIMITED",
    "message": "Слишком много сообщений"
  }
}
```

#### ping
Keep-alive от сервера.

```json
{
  "type": "ping",
  "data": {
    "timestamp": 1735405200000
  }
}
```

---

### Client → Server

#### message
Отправка сообщения.

```json
{
  "type": "message",
  "data": {
    "text": "Текст сообщения",
    "replyTo": "msg-uuid-optional"
  }
}
```

#### typing
Индикатор печати пользователя.

```json
{
  "type": "typing",
  "data": {
    "isTyping": true
  }
}
```

#### close
Закрытие тикета пользователем.

```json
{
  "type": "close",
  "data": {
    "resolved": true,
    "feedback": "Спасибо!"
  }
}
```

#### pong
Ответ на ping.

```json
{
  "type": "pong",
  "data": {
    "timestamp": 1735405200000
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| SESSION_NOT_FOUND | 401 | Сессия не найдена или истекла |
| SESSION_EXPIRED | 401 | Сессия истекла |
| TICKET_CLOSED | 400 | Тикет уже закрыт |
| RATE_LIMITED | 429 | Превышен лимит запросов |
| INVALID_MESSAGE | 400 | Некорректный формат сообщения |
| MESSAGE_TOO_LONG | 400 | Сообщение превышает 4000 символов |
| INTERNAL_ERROR | 500 | Внутренняя ошибка сервера |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| POST /api/chat/message | 10 req/min |
| POST /api/chat/init | 5 req/min |
| GET /api/chat/history | 30 req/min |
| WebSocket messages | 20 msg/min |

---

## Security

### CORS

```
Access-Control-Allow-Origin: https://dellshop.ru
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### Cookie Security

- `HttpOnly` — защита от XSS
- `Secure` — только HTTPS
- `SameSite=Lax` — защита от CSRF при навигации
- `Max-Age=31536000` — 1 год

### Input Validation

- Максимальная длина сообщения: 4000 символов
- Санитизация HTML/скриптов в сообщениях
- Валидация UUID форматов
