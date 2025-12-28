# API Интеграция Chat Widget

> Документация по взаимодействию виджета с бекендом

## Источник

Полная спецификация API от бекенда: [backend-api-spec.md](./backend-api-spec.md)

## Endpoints

### Base URL

```
Production: https://chat.dellshop.ru
WebSocket:  wss://chat.dellshop.ru/ws/chat
```

### HTTP Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/chat/init` | Инициализация сессии |
| GET | `/api/chat/history` | История сообщений |
| GET | `/api/chat/status` | Статус тикета |
| POST | `/api/chat/link-telegram` | Получить ссылку Telegram |
| POST | `/api/chat/close` | Закрыть тикет |

## Сессия

### Cookie-based Authentication

Сессия управляется автоматически через cookie `webchat_session`:

- **HttpOnly** - недоступна из JavaScript (защита XSS)
- **Secure** - только HTTPS
- **SameSite=Lax** - защита CSRF
- **Max-Age=1 год** - долгосрочная сессия

### Важно для виджета

```typescript
// Все HTTP запросы ДОЛЖНЫ включать credentials
fetch('/api/chat/init', {
  method: 'POST',
  credentials: 'include'  // ← Обязательно!
})
```

## Flow инициализации

```
┌─────────────────────────────────────────────────────────┐
│  1. Пользователь открывает виджет                       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  2. POST /api/chat/init                                 │
│     Response: { isNewSession, hasHistory }              │
└─────────────────────────────────────────────────────────┘
                         ↓
        ┌────────────────┴────────────────┐
        ↓                                 ↓
┌───────────────────┐           ┌───────────────────┐
│  hasHistory: true │           │  hasHistory: false│
│  GET /api/chat/   │           │  Skip history     │
│  history?limit=50 │           │  load             │
└───────────────────┘           └───────────────────┘
        └────────────────┬────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  3. WebSocket connect: wss://chat.dellshop.ru/ws/chat   │
│     Cookie отправляется автоматически                   │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  4. Receive 'connected' event                           │
│     { sessionId, ticketStatus, unreadCount }            │
└─────────────────────────────────────────────────────────┘
```

## WebSocket Protocol

### Подключение

```typescript
class WebSocketClient {
  private ws: WebSocket | null = null
  private url = 'wss://chat.dellshop.ru/ws/chat'

  connect() {
    this.ws = new WebSocket(this.url)
    // Cookie отправляется автоматически браузером

    this.ws.onopen = () => this.emit('open')
    this.ws.onmessage = (e) => this.handleMessage(e)
    this.ws.onclose = () => this.handleClose()
    this.ws.onerror = (e) => this.emit('error', e)
  }
}
```

### События от сервера

#### `connected` - успешное подключение

```typescript
interface ConnectedEvent {
  type: 'connected'
  data: {
    sessionId: string
    ticketStatus: 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
    unreadCount: number
  }
}
```

#### `message` - новое сообщение

```typescript
interface MessageEvent {
  type: 'message'
  data: {
    id: string
    text: string
    from: 'user' | 'support'
    timestamp: string  // ISO 8601
  }
}
```

#### `typing` - индикатор печати

```typescript
interface TypingEvent {
  type: 'typing'
  data: {
    isTyping: boolean
  }
}
```

#### `status` - статус тикета

```typescript
interface StatusEvent {
  type: 'status'
  data: {
    status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
  }
}
```

#### `channel_linked` - Telegram подключен

```typescript
interface ChannelLinkedEvent {
  type: 'channel_linked'
  data: {
    telegram: string  // @username
  }
}
```

#### `ping` - keep-alive

```typescript
interface PingEvent {
  type: 'ping'
  data: {
    timestamp: number
  }
}
```

### События от клиента

#### Отправить сообщение

```typescript
ws.send(JSON.stringify({
  type: 'message',
  data: { text: 'Здравствуйте, нужна помощь' }
}))
```

#### Индикатор печати

```typescript
ws.send(JSON.stringify({
  type: 'typing',
  data: { isTyping: true }
}))
```

#### Закрыть тикет

```typescript
ws.send(JSON.stringify({
  type: 'close',
  data: { resolved: true }
}))
```

#### Ответ на ping (pong)

```typescript
ws.send(JSON.stringify({
  type: 'pong',
  data: msg.data  // Вернуть те же данные
}))
```

## Реализация в виджете

### Transport Layer

```typescript
// src/transport/websocket.ts

export class ChatTransport extends EventEmitter {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        resolve()
      }

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        this.handleMessage(msg)
      }

      this.ws.onclose = () => {
        this.emit('disconnected')
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        reject(error)
      }
    })
  }

  private handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'ping':
        this.sendPong(msg.data)
        break
      case 'message':
        this.emit('message', msg.data)
        break
      case 'typing':
        this.emit('typing', msg.data)
        break
      case 'status':
        this.emit('status', msg.data)
        break
      case 'connected':
        this.emit('connected', msg.data)
        break
      case 'channel_linked':
        this.emit('channel_linked', msg.data)
        break
    }
  }

  private sendPong(data: any) {
    this.send({ type: 'pong', data })
  }

  send(message: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('max_reconnect_reached')
      return
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++

    setTimeout(() => {
      this.emit('reconnecting', this.reconnectAttempts)
      this.connect()
    }, delay)
  }
}
```

### HTTP Client

```typescript
// src/transport/http.ts

const BASE_URL = 'https://chat.dellshop.ru'

export class ChatHttpClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',  // Cookie!
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new ChatApiError(response.status, await response.text())
    }

    return response.json()
  }

  async init(): Promise<InitResponse> {
    return this.request('/api/chat/init', { method: 'POST' })
  }

  async getHistory(params: HistoryParams = {}): Promise<HistoryResponse> {
    const query = new URLSearchParams()
    if (params.limit) query.set('limit', params.limit.toString())
    if (params.before) query.set('before', params.before)
    if (params.after) query.set('after', params.after)

    return this.request(`/api/chat/history?${query}`)
  }

  async linkTelegram(): Promise<TelegramLinkResponse> {
    return this.request('/api/chat/link-telegram', { method: 'POST' })
  }

  async close(): Promise<void> {
    return this.request('/api/chat/close', { method: 'POST' })
  }
}
```

## Обработка ошибок

### HTTP ошибки

| Код | Причина | Действие виджета |
|-----|---------|------------------|
| 401 | Сессия не найдена | Вызвать `/api/chat/init` |
| 429 | Rate limit | Показать "Подождите..." |
| 500 | Ошибка сервера | Показать "Попробуйте позже" |

### WebSocket ошибки

```typescript
ws.onclose = (event) => {
  if (event.code === 1006) {
    // Abnormal closure - попытка reconnect
    this.scheduleReconnect()
  } else if (event.code === 4001) {
    // Custom: session expired
    this.reinitSession()
  }
}
```

## Лимиты

| Параметр | Значение |
|----------|----------|
| Сообщений в минуту | 20 |
| Символов в сообщении | 4000 |
| History limit | 50 (default) |
| Reconnect attempts | 5 |
| Ping interval | 30 сек (сервер) |

## Telegram интеграция

### Получение ссылки

```typescript
async function openTelegram() {
  try {
    const response = await httpClient.linkTelegram()
    // response.data.telegramUrl = "https://t.me/dellshop_support_bot?start=link_xxx"

    window.open(response.data.telegramUrl, '_blank')
  } catch (error) {
    showError('Не удалось получить ссылку')
  }
}
```

### После перехода

Когда пользователь активирует Telegram:
1. Виджет получит событие `channel_linked`
2. Можно показать уведомление "Telegram подключен"
3. История синхронизируется между каналами

```typescript
transport.on('channel_linked', (data) => {
  showNotification(`Telegram ${data.telegram} подключен`)
  // Обновить UI - показать индикатор Telegram
})
```

## Типы данных

```typescript
// src/types/api.ts

export interface Message {
  id: string
  text: string
  from: 'user' | 'support'
  timestamp: string
}

export interface InitResponse {
  data: {
    isNewSession: boolean
    hasHistory: boolean
  }
}

export interface HistoryResponse {
  data: {
    messages: Message[]
    hasMore: boolean
  }
}

export interface ConnectedData {
  sessionId: string
  ticketStatus: 'NEW' | 'IN_PROGRESS' | 'RESOLVED'
  unreadCount: number
}

export type ServerMessage =
  | { type: 'connected'; data: ConnectedData }
  | { type: 'message'; data: Message }
  | { type: 'typing'; data: { isTyping: boolean } }
  | { type: 'status'; data: { status: string } }
  | { type: 'channel_linked'; data: { telegram: string } }
  | { type: 'ping'; data: { timestamp: number } }

export type ClientMessage =
  | { type: 'message'; data: { text: string } }
  | { type: 'typing'; data: { isTyping: boolean } }
  | { type: 'close'; data: { resolved: boolean } }
  | { type: 'pong'; data: any }
```
