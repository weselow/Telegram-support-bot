# Widget Unit Tests

**Дата:** 2025-12-30
**Источник:** TD-033

## Проблема

Chat widget не имел unit тестов для критических компонентов:
- `escape.ts` — XSS защита (приоритет HIGH)
- `websocket.ts` — WebSocket reconnect (приоритет HIGH)
- `http.ts` — обработка ошибок HTTP (приоритет Medium)
- `state.ts` — управление состоянием (приоритет Medium)

## Причина

Компоненты были написаны без тестов, что затрудняло рефакторинг и не гарантировало корректность работы критической функциональности (XSS защита, reconnect логика).

## Решение

### 1. Настроена тестовая инфраструктура

- Добавлен `vitest.config.ts` с jsdom environment
- Установлена зависимость `jsdom` для DOM API в тестах

### 2. Написаны тесты (114 тестов)

| Файл | Тестов | Покрытие |
|------|--------|----------|
| `escape.test.ts` | 39 | XSS векторы, sanitization, форматирование |
| `http.test.ts` | 21 | Ошибки, 401 recovery, 429 rate limiting |
| `websocket.test.ts` | 28 | Connect, reconnect, message queue |
| `state.test.ts` | 26 | State management, events |

### 3. Исправлены обнаруженные баги

#### formatTime/formatDate возвращали "Invalid Date"
```typescript
// Было: new Date('invalid').toLocaleTimeString() → "Invalid Date"
// Стало: проверка isNaN(date.getTime()) → ""
```

#### WebSocket reconnect не работал после закрытия соединения
```typescript
// Было: if (this.ws && this._state === 'connected')
// Проблема: this.ws существует даже когда readyState === CLOSED

// Стало: if (this.ws?.readyState === WebSocket.OPEN && this._state === 'connected')
```

#### Неверный тип currentVariant в widget.ts
```typescript
// Было: private currentVariant: WidgetVariant  // включает 'auto'
// Стало: private currentVariant: 'modal' | 'drawer'  // только реальные варианты
```

## Изменённые файлы

- `chat-widget/vitest.config.ts` — создан конфиг Vitest с jsdom
- `chat-widget/package.json` — добавлен jsdom
- `chat-widget/src/utils/escape.ts` — исправлена обработка невалидных дат
- `chat-widget/src/transport/websocket.ts` — исправлен reconnect
- `chat-widget/src/widget.ts` — исправлен тип currentVariant
- `chat-widget/src/__tests__/utils/escape.test.ts` — 39 тестов XSS
- `chat-widget/src/__tests__/transport/http.test.ts` — 21 тест HTTP
- `chat-widget/src/__tests__/transport/websocket.test.ts` — 28 тестов WS
- `chat-widget/src/__tests__/core/state.test.ts` — 26 тестов state

## Важно для разработчика

### XSS защита (escape.ts)
- `escapeHtml()` использует `textContent`/`innerHTML` технику — экранирует `<>` символы
- Все теги становятся безопасным текстом: `<script>` → `&lt;script&gt;`
- `sanitizeInput()` обрезает до 4000 символов и нормализует пробелы

### WebSocket reconnect
- Reconnect использует exponential backoff: `delay * 2^attempt`
- По умолчанию 5 попыток с начальной задержкой 1000ms
- `reconnectCount` сбрасывается при успешном `onopen`
- Проверка `readyState === OPEN` критична для корректной работы

### HTTP 401 Recovery
- При 401 автоматически вызывается `init()` и повторяется запрос
- Защита от бесконечного цикла через флаг `isRetrying`

### State Manager
- EventEmitter паттерн для подписки на изменения
- `setState()` не эмитит событие если состояние не изменилось
- `clearUnread()` не эмитит если счётчик уже 0
