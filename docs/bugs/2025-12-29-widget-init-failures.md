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

## Причины (две)

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

### 2. Auto-init не срабатывал из-за Next.js lazyOnload

Next.js Script component с `strategy="lazyOnload"` добавляет атрибут `data-nscript="lazyOnload"`. При этом:

1. Скрипт загружается после `DOMContentLoaded`
2. `autoInit()` вызывался, но при ошибке `window.DellShopChat` перезаписывался без `instance`
3. Виджет оставался без инициализации, ошибка проглатывалась

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

### Fix 2: Robust auto-init (chat-widget/src/index.ts)

```typescript
// 1. Создаём объект СРАЗУ (до autoInit)
window.DellShopChat = {
  Widget: ChatWidget,
  instance: null,
  open: () => window.DellShopChat.instance?.open(),
  // ... остальные методы
}

// 2. autoInit обёрнут в try-catch
function autoInit() {
  try {
    if (window.DellShopChat.instance) return // защита от повторной инициализации

    // Расширенный селектор
    const scripts = document.querySelectorAll('script[src*="widget"], script[src*="chat"]')

    const widget = new ChatWidget(config)
    window.DellShopChat.instance = widget // сохраняем ДО init()
    widget.init()
  } catch (error) {
    console.error('[ChatWidget] Auto-init failed:', error)
  }
}
```

## Изменённые файлы

- `chat-widget/src/transport/http.ts` — автоматический `body: '{}'` для POST/PUT/PATCH
- `chat-widget/src/index.ts` — robust auto-init без race condition

## Коммиты

- `e55687c` — fix: send empty JSON body for POST requests in chat widget
- `6370d22` — fix: improve chat widget auto-init for Next.js lazyOnload

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
