# Web Chat Widget — Руководство разработчика

> Инструкция по интеграции виджета чата с API поддержки DellShop

## Обзор

Виджет живого чата для сайта dellshop.ru. Пользователь может анонимно написать в поддержку, получить ответ в реальном времени, и при желании продолжить диалог в Telegram.

---

## Быстрый старт

### 1. Подключение к WebSocket

```javascript
const ws = new WebSocket('wss://chat.dellshop.ru/ws/chat')

ws.onopen = () => {
  console.log('Connected to support chat')
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  handleMessage(message)
}
```

### 2. Отправка сообщения

```javascript
ws.send(JSON.stringify({
  type: 'message',
  data: { text: 'Здравствуйте, нужна помощь' }
}))
```

### 3. Получение ответа

```javascript
function handleMessage(msg) {
  if (msg.type === 'message') {
    displayMessage(msg.data)
  }
}
```

---

## API Endpoints

### Base URL
```
Production: https://chat.dellshop.ru
```

### HTTP Endpoints

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/chat/init` | Инициализация сессии |
| GET | `/api/chat/history` | История сообщений |
| GET | `/api/chat/status` | Статус тикета |
| POST | `/api/chat/link-telegram` | Получить ссылку для Telegram |
| POST | `/api/chat/close` | Закрыть тикет |

### WebSocket
```
wss://chat.dellshop.ru/ws/chat
```

---

## Сессия пользователя

### Автоматическое управление

Сессия хранится в cookie `webchat_session`. API сам создаёт и управляет этой cookie:

- **HttpOnly** — недоступна из JavaScript (защита от XSS)
- **Secure** — только HTTPS
- **SameSite=Lax** — защита от CSRF
- **Max-Age=1 год** — долгосрочная сессия

### Что это значит для виджета

1. **Не нужно хранить session ID** — браузер автоматически отправляет cookie
2. **Сессия сохраняется между визитами** — пользователь увидит историю
3. **Chrome Sync** — сессия синхронизируется между устройствами пользователя

### Инициализация

При первом открытии виджета вызвать:

```javascript
const response = await fetch('/api/chat/init', {
  method: 'POST',
  credentials: 'include' // Важно для cookies!
})

const { data } = await response.json()
// data.isNewSession — новый пользователь или вернувшийся
// data.hasHistory — есть ли предыдущие сообщения
```

---

## WebSocket Protocol

### Подключение

```javascript
const ws = new WebSocket('wss://chat.dellshop.ru/ws/chat')
// Cookie отправляется автоматически
```

### События от сервера

#### `connected` — успешное подключение
```json
{
  "type": "connected",
  "data": {
    "sessionId": "abc123",
    "ticketStatus": "NEW",
    "unreadCount": 0
  }
}
```

#### `message` — новое сообщение
```json
{
  "type": "message",
  "data": {
    "id": "msg-uuid",
    "text": "Добрый день! Чем могу помочь?",
    "from": "support",
    "timestamp": "2025-12-28T18:10:00Z"
  }
}
```

#### `typing` — поддержка печатает
```json
{
  "type": "typing",
  "data": { "isTyping": true }
}
```

#### `status` — статус тикета изменён
```json
{
  "type": "status",
  "data": { "status": "IN_PROGRESS" }
}
```

#### `channel_linked` — Telegram подключен
```json
{
  "type": "channel_linked",
  "data": { "telegram": "@username" }
}
```

### События от клиента

#### Отправить сообщение
```json
{
  "type": "message",
  "data": { "text": "Текст сообщения" }
}
```

#### Индикатор печати
```json
{
  "type": "typing",
  "data": { "isTyping": true }
}
```

#### Закрыть тикет
```json
{
  "type": "close",
  "data": { "resolved": true }
}
```

### Keep-alive

Сервер отправляет `ping` каждые 30 секунд. Отвечать `pong`:

```javascript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', data: msg.data }))
  }
}
```

---

## Получение истории

При открытии виджета загрузить историю:

```javascript
const response = await fetch('/api/chat/history?limit=50', {
  credentials: 'include'
})

const { data } = await response.json()
// data.messages — массив сообщений
// data.hasMore — есть ли ещё (для подгрузки)
```

### Пагинация (подгрузка старых)

```javascript
const response = await fetch(`/api/chat/history?limit=50&before=${oldestMessageId}`, {
  credentials: 'include'
})
```

### После reconnect (новые сообщения)

```javascript
const response = await fetch(`/api/chat/history?after=${lastMessageId}`, {
  credentials: 'include'
})
```

---

## Переход в Telegram

Кнопка "Продолжить в Telegram" должна:

```javascript
async function openTelegram() {
  const response = await fetch('/api/chat/link-telegram', {
    method: 'POST',
    credentials: 'include'
  })

  const { data } = await response.json()
  // data.telegramUrl = "https://t.me/dellshop_support_bot?start=link_xxx"

  window.open(data.telegramUrl, '_blank')
}
```

После перехода в Telegram:
- Пользователь получит историю чата в боте
- Виджет получит событие `channel_linked`
- Можно показать уведомление "Telegram подключен"

---

## UI/UX Требования

### Минимальный интерфейс

1. **Кнопка открытия** — плавающая кнопка в углу экрана
2. **Окно чата** — открывается по клику
3. **Поле ввода** — текст + кнопка отправки
4. **Список сообщений** — с автоскроллом вниз
5. **Индикатор печати** — "Поддержка печатает..."

### Обязательные элементы

- [ ] Кнопка "Продолжить в Telegram" (иконка Telegram)
- [ ] Индикатор статуса подключения (online/offline)
- [ ] Время отправки сообщений
- [ ] Визуальное разделение своих и чужих сообщений

### Рекомендации

- **Звук уведомления** при новом сообщении (если вкладка не активна)
- **Badge на кнопке** с количеством непрочитанных
- **Аватар поддержки** — можно использовать лого DellShop
- **Анимация печати** — три точки

### Адаптивность

- Desktop: виджет в правом нижнем углу, ~400x500px
- Mobile: полноэкранный режим при открытии

---

## Обработка ошибок

### WebSocket disconnect

```javascript
ws.onclose = () => {
  showStatus('Соединение потеряно')
  // Автоматический reconnect через 3 секунды
  setTimeout(connect, 3000)
}
```

### HTTP ошибки

| Код | Значение | Действие |
|-----|----------|----------|
| 401 | Сессия не найдена | Вызвать `/api/chat/init` |
| 429 | Rate limit | Показать "Подождите..." |
| 500 | Ошибка сервера | Показать "Попробуйте позже" |

### Лимиты

- Максимум 20 сообщений в минуту
- Максимум 4000 символов в сообщении

---

## Безопасность

### CORS

Виджет должен работать с домена `dellshop.ru`. API настроен на:
```
Access-Control-Allow-Origin: https://dellshop.ru
Access-Control-Allow-Credentials: true
```

### XSS защита

- Экранировать HTML в сообщениях перед отображением
- Не использовать `innerHTML` для пользовательского контента

```javascript
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
```

---

## Пример минимальной реализации

```html
<div id="chat-widget">
  <button id="chat-toggle">💬</button>
  <div id="chat-window" hidden>
    <div id="chat-messages"></div>
    <input id="chat-input" placeholder="Напишите сообщение...">
    <button id="chat-send">→</button>
  </div>
</div>

<script>
let ws

async function init() {
  await fetch('https://chat.dellshop.ru/api/chat/init', {
    method: 'POST',
    credentials: 'include'
  })

  ws = new WebSocket('wss://chat.dellshop.ru/ws/chat')

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data)
    if (msg.type === 'message') {
      addMessage(msg.data.text, msg.data.from)
    }
  }
}

function sendMessage() {
  const input = document.getElementById('chat-input')
  ws.send(JSON.stringify({
    type: 'message',
    data: { text: input.value }
  }))
  addMessage(input.value, 'user')
  input.value = ''
}

function addMessage(text, from) {
  const div = document.createElement('div')
  div.className = `message ${from}`
  div.textContent = text
  document.getElementById('chat-messages').appendChild(div)
}

init()
</script>
```

---

## Контакты

По вопросам интеграции: [контакт backend-разработчика]

Документация API: `docs/modules/web-chat-api/api-spec.md`
