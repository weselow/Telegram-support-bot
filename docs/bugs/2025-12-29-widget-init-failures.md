# Widget: Init failures (POST body + auto-init)

**Дата:** 2025-12-29
**Статус:** DONE

## Проблема

Чат-виджет показывает ошибку в консоли:
```
Cross-Origin Request Blocked: ... Status code: 400
[ChatWidget] Connection failed: Error
```

При этом CORS настроен правильно, cookie blocking исправлен (см. 2025-12-29-widget-third-party-cookie-blocking.md).

## Причины (три)

### 1. Fastify требует body для POST с Content-Type: application/json

HTTP клиент виджета устанавливал заголовок `Content-Type: application/json`, но не отправлял body для POST запросов (`init`, `linkTelegram`, `close`).

Fastify возвращал ошибку:
```json
{
  "statusCode": 400,
  "code": "FST_ERR_CTP_EMPTY_JSON_BODY",
  "message": "Body cannot be empty when content-type is set to 'application/json'"
}
```

**Важно:** Браузеры маскируют 400 ошибку как CORS, потому что сервер не отправляет CORS headers в error response.

### 2. esbuild globalName перезаписывал window.DellShopChat

**Главная причина!** esbuild с опцией `globalName: 'DellShopChat'` генерировал:

```javascript
var DellShopChat = (() => {
  // Внутри IIFE: window.DellShopChat = { Widget, instance, open, ... }
  return { Widget }  // module exports
})()
// Результат: DellShopChat = { Widget } — ПЕРЕЗАПИСЫВАЕТ window.DellShopChat!
```

В итоге `window.DellShopChat` содержал только `{ Widget }` без `instance` и convenience methods.

### 3. Auto-init мог не срабатывать из-за timing issues

Next.js Script component с `strategy="lazyOnload"` загружает скрипт во время browser idle. При различных timing условиях auto-init мог не успевать выполниться.

## Решение

### Fix 1: Автоматический body для POST (chat-widget/src/transport/http.ts)

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${this.baseUrl}${endpoint}`

  // For POST requests without body, send empty JSON to satisfy Fastify
  const method = options.method?.toUpperCase()
  const needsBody = method === 'POST' || method === 'PUT' || method === 'PATCH'
  const body = options.body ?? (needsBody ? '{}' : undefined)

  const response = await fetch(url, {
    ...options,
    body,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers }
  })
  // ...
}
```

### Fix 2: Удаление globalName из esbuild (chat-widget/esbuild.config.js)

```javascript
const jsConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/chat-widget.js',
  format: 'iife',
  // Note: No globalName - we manually set window.DellShopChat in index.ts
  // to avoid esbuild overwriting our object with just the exports
  platform: 'browser',
  // ...
}
```

### Fix 3: Robust auto-init с retry (chat-widget/src/index.ts)

```typescript
// 1. Создаём объект СРАЗУ в начале скрипта
window.DellShopChat = {
  Widget: ChatWidget,
  instance: null,
  open: () => window.DellShopChat.instance?.open(),
  // ... остальные методы
}

// 2. initWithRetry — множественные попытки инициализации
function initWithRetry() {
  if (autoInit()) return  // Strategy 1: Immediate

  Promise.resolve().then(() => {  // Strategy 2: Microtask
    if (autoInit()) return

    requestAnimationFrame(() => {  // Strategy 3: Next frame
      if (autoInit()) return

      setTimeout(() => {  // Strategy 4: 100ms delay
        if (autoInit()) return
        setTimeout(() => autoInit(), 400)  // Strategy 5: 500ms delay
      }, 100)
    })
  })
}
```

## Изменённые файлы

- `chat-widget/src/transport/http.ts` — автоматический `body: '{}'` для POST/PUT/PATCH
- `chat-widget/esbuild.config.js` — удалён `globalName: 'DellShopChat'`
- `chat-widget/src/index.ts` — robust auto-init с retry mechanism

### Fix 4: Message queue для сообщений до подключения (chat-widget/src/transport/websocket.ts)

Сообщения, отправленные до установки WebSocket соединения, терялись. Добавлена очередь:

```typescript
private messageQueue: ClientEvent[] = []

private send(event: ClientEvent): void {
  if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
    if (event.type === 'message') {
      this.messageQueue.push(event)
      console.log('[ChatWidget] Message queued, waiting for connection')
    }
    return
  }
  // ... send
}

private flushMessageQueue(): void {
  // Вызывается при получении 'connected' события
  for (const event of this.messageQueue) {
    this.send(event)
  }
  this.messageQueue = []
}
```

### Fix 5: Error handling для async onClick (chat-widget/src/widget.ts)

Async методы в onClick без `.catch()` теряли ошибки:

```typescript
private createButton(): void {
  this.button = new ChatButton({
    onClick: () => {
      this.open().catch(err => console.error('[ChatWidget] open() error:', err))
    }
  })
}
```

## Изменённые файлы

- `chat-widget/src/transport/http.ts` — автоматический `body: '{}'` для POST/PUT/PATCH
- `chat-widget/esbuild.config.js` — удалён `globalName: 'DellShopChat'`
- `chat-widget/src/index.ts` — robust auto-init с retry mechanism
- `chat-widget/src/transport/websocket.ts` — message queue
- `chat-widget/src/widget.ts` — error handling и debug logging

## Коммиты

- `e55687c` — fix: send empty JSON body for POST requests in chat widget
- `6370d22` — fix: improve chat widget auto-init for Next.js lazyOnload
- `ce73d61` — fix(widget): remove globalName to prevent DellShopChat overwrite
- `229cb2b` — fix(widget): queue messages when WebSocket not yet connected
- `cc3bfd5` — fix(widget): add logging and error handling for open()

## Важно для разработчика

1. **Диагностика CORS ошибок:** Если браузер показывает CORS error, проверь реальный HTTP status в Firefox (он показывает `Status code: XXX` в сообщении ошибки)

2. **Fastify + Content-Type:** При `Content-Type: application/json` Fastify требует непустой body. Либо отправляй `'{}'`, либо не устанавливай этот header.

3. **Next.js lazyOnload:** Скрипты с `strategy="lazyOnload"` выполняются после полной загрузки страницы. Auto-init должен быть устойчив к ошибкам.

## Тестирование

1. Открыть dellshop.ru в режиме инкогнито
2. Открыть DevTools → Console
3. Виджет должен инициализироваться без ошибок
4. Проверить: `window.DellShopChat.instance` !== null
5. Отправить сообщение — должно работать
