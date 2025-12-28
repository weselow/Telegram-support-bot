# Архитектура Chat Widget

## Принятые решения

### 1. Технологический стек

| Компонент | Решение | Обоснование |
|-----------|---------|-------------|
| **Bundler** | esbuild | Скорость сборки, tree-shaking, минимальный output |
| **Язык** | TypeScript | Типобезопасность, лучший DX |
| **Стили** | Lazy CSS Loading | Отдельные CSS файлы по variant, минимизация начальной загрузки |
| **Шаблоны** | Template literals | Нет зависимостей, минимальный размер |
| **Протокол** | WebSocket | Real-time требование от бекенда |

### 1.1 Стратегия загрузки стилей (Lazy CSS)

**Проблема:** Оба варианта дизайна (modal + drawer) увеличивают размер бандла.

**Решение:** Lazy loading CSS по выбранному variant.

```
chat-widget.js           ~12KB  ← Всегда загружается
chat-widget-base.css     ~2KB   ← Общие стили (загружается с JS)
chat-widget-modal.css    ~2KB   ← Только если variant='modal'
chat-widget-drawer.css   ~2KB   ← Только если variant='drawer'
```

**Логика загрузки:**

```typescript
function loadVariantStyles(variant: 'modal' | 'drawer') {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `${CDN_URL}/chat-widget-${variant}.css`
  document.head.appendChild(link)
  return new Promise(resolve => link.onload = resolve)
}

// При инициализации
async function init(config: WidgetConfig) {
  const variant = resolveVariant(config) // 'modal' | 'drawer'
  await loadVariantStyles(variant)
  renderWidget(variant)
}
```

**Преимущества:**
- Начальная загрузка ~14KB вместо ~16KB
- CSS кешируется отдельно от JS
- При смене variant не перезагружается JS

### 2. Структура проекта

```
chat-widget/
├── docs/                    # Документация
│   ├── README.md
│   ├── architecture.md      # (этот файл)
│   ├── design-variants.md
│   ├── api-integration.md
│   ├── backend-api-spec.md  # API спецификация от бекенда
│   ├── styling.md
│   └── TODO.md              # Тех. долг и открытые вопросы
├── src/
│   ├── index.ts             # Entry point, публичный API
│   ├── core/
│   │   ├── widget.ts        # Главный класс виджета
│   │   ├── state.ts         # State management
│   │   └── events.ts        # Event emitter
│   ├── transport/
│   │   ├── websocket.ts     # WebSocket клиент
│   │   ├── http.ts          # HTTP клиент для init/history
│   │   └── reconnect.ts     # Логика переподключения
│   ├── ui/
│   │   ├── components/
│   │   │   ├── button.ts    # Floating button
│   │   │   ├── modal.ts     # Modal variant
│   │   │   ├── drawer.ts    # Drawer variant
│   │   │   ├── messages.ts  # Message list
│   │   │   ├── input.ts     # Input field
│   │   │   └── telegram.ts  # Telegram banner
│   │   └── styles/
│   │       ├── base.css     # Общие стили (всегда загружаются)
│   │       ├── modal.css    # Стили modal варианта
│   │       └── drawer.css   # Стили drawer варианта
│   ├── utils/
│   │   ├── dom.ts           # DOM helpers
│   │   ├── escape.ts        # XSS protection
│   │   └── storage.ts       # LocalStorage для drafts
│   └── types/
│       ├── config.ts        # Configuration types
│       ├── messages.ts      # Message types
│       └── events.ts        # Event types
├── mockup.html              # Visual preview - modal
├── mockup-drawer.html       # Visual preview - drawer
├── package.json
├── tsconfig.json
└── esbuild.config.js
```

### 3. Архитектурные паттерны

#### State Machine для UI состояний

```typescript
type WidgetState =
  | 'closed'           // Виджет свернут
  | 'open'             // Открыт, готов к работе
  | 'connecting'       // Подключение к WebSocket
  | 'connected'        // Подключен, активный чат
  | 'disconnected'     // Потеря соединения
  | 'offline'          // Операторы недоступны
  | 'error'            // Критическая ошибка

// Валидные переходы
const transitions = {
  closed: ['open'],
  open: ['closed', 'connecting'],
  connecting: ['connected', 'disconnected', 'error'],
  connected: ['closed', 'disconnected', 'offline'],
  disconnected: ['connecting', 'closed'],
  offline: ['closed', 'connecting'],
  error: ['closed', 'connecting']
}
```

#### Event-Driven архитектура

```typescript
// Внутренние события
interface WidgetEvents {
  'state:change': (state: WidgetState) => void
  'message:received': (message: Message) => void
  'message:sent': (message: Message) => void
  'typing:start': () => void
  'typing:stop': () => void
  'connection:open': () => void
  'connection:close': () => void
  'connection:error': (error: Error) => void
}
```

#### Dependency Injection

```typescript
class ChatWidget {
  constructor(
    private transport: ITransport,
    private ui: IUIRenderer,
    private storage: IStorage,
    private config: WidgetConfig
  ) {}
}

// Позволяет тестировать с моками
const widget = new ChatWidget(
  new WebSocketTransport(wsUrl),
  new DOMRenderer(container),
  new LocalStorageAdapter(),
  config
)
```

### 4. Стратегия загрузки

```
Страница загружается
       ↓
Script загружается (async/defer)
       ↓
DOMContentLoaded или сразу если DOM готов
       ↓
Инициализация виджета
├── Создание Shadow DOM контейнера
├── Инъекция стилей
└── Рендер кнопки
       ↓
Клик по кнопке
       ↓
Полная инициализация
├── HTTP: /api/chat/init
├── HTTP: /api/chat/history (если есть)
├── WebSocket: connect
└── Рендер полного UI
```

### 5. Производительность

#### Lazy Loading

- **Кнопка**: ~3KB - загружается сразу
- **Полный UI**: ~12KB - загружается по клику
- **История**: По запросу через API

#### Memory Management

```typescript
class MessageList {
  private messages: Message[] = []
  private maxMessages = 100

  add(message: Message) {
    this.messages.push(message)
    // Удаляем старые сообщения из DOM
    if (this.messages.length > this.maxMessages) {
      this.messages.shift()
      this.removeOldestFromDOM()
    }
  }
}
```

#### Event Delegation

```typescript
// Один listener на контейнер вместо множества
container.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  if (target.matches('[data-action="send"]')) {
    this.sendMessage()
  } else if (target.matches('[data-action="telegram"]')) {
    this.openTelegram()
  }
})
```

### 6. Безопасность

#### XSS Protection

```typescript
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Использование
messageEl.innerHTML = `
  <div class="message">
    ${escapeHtml(message.text)}
  </div>
`
```

#### Shadow DOM Isolation

```typescript
class WidgetContainer {
  private shadow: ShadowRoot

  constructor(host: HTMLElement) {
    this.shadow = host.attachShadow({ mode: 'closed' })
    // Стили хост-сайта не влияют на виджет
    // Стили виджета не влияют на хост-сайт
  }
}
```

#### CSP Compatibility

- Inline стили через `<style>` в Shadow DOM
- Нет eval() или Function()
- Нет inline event handlers в HTML

### 7. Обработка ошибок

```typescript
class ErrorBoundary {
  wrap<T>(fn: () => T, fallback: T): T {
    try {
      return fn()
    } catch (error) {
      this.report(error)
      return fallback
    }
  }

  private report(error: Error) {
    // Log to console in dev
    console.error('[DellShopChat]', error)

    // Could send to error tracking service
    // if (config.errorTracking) { ... }
  }
}
```

### 8. Тестирование

#### Unit Tests

```typescript
describe('MessageList', () => {
  it('should escape HTML in messages', () => {
    const list = new MessageList()
    list.add({ text: '<script>alert(1)</script>' })

    expect(list.render()).not.toContain('<script>')
  })
})
```

#### Integration Tests

```typescript
describe('WebSocket Integration', () => {
  it('should reconnect on disconnect', async () => {
    const ws = new WebSocketClient(url)
    await ws.connect()

    // Simulate disconnect
    ws.close()

    // Should auto-reconnect
    await waitFor(() => ws.isConnected)
    expect(ws.isConnected).toBe(true)
  })
})
```

### 9. Bundle Size Budget

| Компонент | Размер (gzip) |
|-----------|---------------|
| Core | ~4KB |
| Transport | ~3KB |
| UI Components | ~6KB |
| Styles | ~2KB |
| Utils | ~1KB |
| **Total** | **~16KB** |

### 10. Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Не поддерживаем IE11 (нет WebSocket, Shadow DOM).
