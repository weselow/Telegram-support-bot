# Стилизация Chat Widget

## Базовый стиль

Виджет использует стиль, согласованный с rackparts.ru:

### Цветовая палитра

```css
:host {
  /* Brand - основной синий */
  --chat-brand: #1e3a8a;
  --chat-brand-hover: #1e40af;
  --chat-brand-light: #dbeafe;

  /* Background */
  --chat-bg: #ffffff;
  --chat-bg-secondary: #f8fafc;
  --chat-bg-tertiary: #f1f5f9;

  /* Text */
  --chat-text: #1e293b;
  --chat-text-secondary: #64748b;
  --chat-text-muted: #94a3b8;
  --chat-text-inverse: #ffffff;

  /* Border */
  --chat-border: #e2e8f0;
  --chat-border-focus: #1e3a8a;

  /* Status */
  --chat-success: #22c55e;
  --chat-warning: #f59e0b;
  --chat-error: #ef4444;

  /* Telegram */
  --chat-telegram: #0088cc;
}
```

### Геометрия

```css
:host {
  /* Border radius */
  --chat-radius-xs: 6px;
  --chat-radius-sm: 8px;
  --chat-radius: 12px;
  --chat-radius-lg: 16px;
  --chat-radius-xl: 20px;
  --chat-radius-full: 9999px;

  /* Spacing */
  --chat-space-xs: 4px;
  --chat-space-sm: 8px;
  --chat-space: 12px;
  --chat-space-md: 16px;
  --chat-space-lg: 20px;
  --chat-space-xl: 24px;

  /* Shadows */
  --chat-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --chat-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  --chat-shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1);
  --chat-shadow-xl: 0 25px 50px -12px rgba(0,0,0,0.25);
}
```

### Типографика

```css
:host {
  /* Font family */
  --chat-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  /* Font sizes */
  --chat-text-xs: 11px;
  --chat-text-sm: 13px;
  --chat-text-base: 14px;
  --chat-text-lg: 16px;
  --chat-text-xl: 18px;

  /* Line heights */
  --chat-leading-tight: 1.25;
  --chat-leading-normal: 1.5;
  --chat-leading-relaxed: 1.625;
}
```

## CSS-in-JS реализация

### Базовые стили

```typescript
// src/ui/styles.ts

export const baseStyles = `
  :host {
    --chat-brand: #1e3a8a;
    /* ... остальные переменные ... */
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .chat-widget {
    font-family: var(--chat-font);
    font-size: var(--chat-text-base);
    line-height: var(--chat-leading-normal);
    color: var(--chat-text);
    -webkit-font-smoothing: antialiased;
  }
`
```

### Компонентные стили

```typescript
// Кнопка открытия
export const buttonStyles = `
  .chat-button {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 60px;
    height: 60px;
    border-radius: var(--chat-radius-full);
    background: var(--chat-brand);
    color: var(--chat-text-inverse);
    border: none;
    cursor: pointer;
    box-shadow: var(--chat-shadow-lg);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s, background 0.2s;
    z-index: 10000;
  }

  .chat-button:hover {
    background: var(--chat-brand-hover);
    transform: scale(1.05);
  }

  .chat-button-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    background: var(--chat-error);
    color: white;
    font-size: var(--chat-text-xs);
    font-weight: 600;
    border-radius: var(--chat-radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
  }
`

// Modal container
export const modalStyles = `
  .chat-modal {
    position: fixed;
    bottom: 100px;
    right: 24px;
    width: 380px;
    height: 520px;
    background: var(--chat-bg);
    border-radius: var(--chat-radius-lg);
    box-shadow: var(--chat-shadow-xl);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 10001;
  }
`

// Drawer container
export const drawerStyles = `
  .chat-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 10000;
  }

  .chat-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: 420px;
    height: 100vh;
    background: var(--chat-bg);
    box-shadow: var(--chat-shadow-xl);
    display: flex;
    flex-direction: column;
    z-index: 10001;
  }

  @media (max-width: 480px) {
    .chat-drawer {
      width: 100vw;
    }
  }
`

// Header
export const headerStyles = `
  .chat-header {
    padding: var(--chat-space-md);
    background: var(--chat-brand);
    color: var(--chat-text-inverse);
    display: flex;
    align-items: center;
    gap: var(--chat-space);
  }

  .chat-header-logo {
    width: 32px;
    height: 32px;
    background: white;
    border-radius: var(--chat-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chat-header-title {
    flex: 1;
    font-weight: 600;
    font-size: var(--chat-text-lg);
  }

  .chat-header-status {
    font-size: var(--chat-text-sm);
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .chat-header-status::before {
    content: '';
    width: 8px;
    height: 8px;
    background: var(--chat-success);
    border-radius: 50%;
  }

  .chat-header-close {
    width: 32px;
    height: 32px;
    background: rgba(255,255,255,0.1);
    border: none;
    border-radius: var(--chat-radius-sm);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`

// Messages
export const messagesStyles = `
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: var(--chat-space-md);
    display: flex;
    flex-direction: column;
    gap: var(--chat-space);
  }

  .chat-message {
    max-width: 80%;
    padding: var(--chat-space) var(--chat-space-md);
    border-radius: var(--chat-radius);
  }

  .chat-message-support {
    align-self: flex-start;
    background: var(--chat-bg-tertiary);
    border-bottom-left-radius: var(--chat-radius-xs);
  }

  .chat-message-user {
    align-self: flex-end;
    background: var(--chat-brand);
    color: var(--chat-text-inverse);
    border-bottom-right-radius: var(--chat-radius-xs);
  }

  .chat-message-time {
    font-size: var(--chat-text-xs);
    color: var(--chat-text-muted);
    margin-top: var(--chat-space-xs);
    text-align: right;
  }

  .chat-message-user .chat-message-time {
    color: rgba(255,255,255,0.7);
  }
`

// Typing indicator
export const typingStyles = `
  .chat-typing {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: var(--chat-space);
    color: var(--chat-text-secondary);
    font-size: var(--chat-text-sm);
  }

  .chat-typing-dots {
    display: flex;
    gap: 4px;
  }

  .chat-typing-dot {
    width: 6px;
    height: 6px;
    background: var(--chat-text-muted);
    border-radius: 50%;
    animation: typing 1.4s infinite ease-in-out;
  }

  .chat-typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .chat-typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }
`

// Input
export const inputStyles = `
  .chat-input-container {
    padding: var(--chat-space-md);
    border-top: 1px solid var(--chat-border);
    display: flex;
    gap: var(--chat-space);
  }

  .chat-input {
    flex: 1;
    padding: var(--chat-space) var(--chat-space-md);
    border: 1px solid var(--chat-border);
    border-radius: var(--chat-radius);
    font-size: var(--chat-text-base);
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .chat-input:focus {
    border-color: var(--chat-border-focus);
  }

  .chat-input::placeholder {
    color: var(--chat-text-muted);
  }

  .chat-send-button {
    width: 44px;
    height: 44px;
    background: var(--chat-brand);
    color: var(--chat-text-inverse);
    border: none;
    border-radius: var(--chat-radius);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .chat-send-button:hover {
    background: var(--chat-brand-hover);
  }

  .chat-send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

// Telegram banner
export const telegramStyles = `
  .chat-telegram {
    margin: var(--chat-space-md);
    padding: var(--chat-space);
    background: var(--chat-bg-secondary);
    border-radius: var(--chat-radius);
    display: flex;
    align-items: center;
    gap: var(--chat-space);
    cursor: pointer;
    transition: background 0.2s;
  }

  .chat-telegram:hover {
    background: var(--chat-bg-tertiary);
  }

  .chat-telegram-icon {
    width: 32px;
    height: 32px;
    background: var(--chat-telegram);
    border-radius: var(--chat-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .chat-telegram-text {
    flex: 1;
    font-size: var(--chat-text-sm);
  }

  .chat-telegram-arrow {
    color: var(--chat-text-muted);
  }
`
```

## Кастомизация

### Через CSS переменные

```html
<script>
  window.DellShopChatConfig = {
    theme: {
      brandColor: '#10b981',  // Зеленый вместо синего
      borderRadius: '8px',
      fontFamily: 'Inter, sans-serif'
    }
  }
</script>
```

### Применение в коде

```typescript
function applyCustomTheme(config: ThemeConfig) {
  const root = shadowRoot.host as HTMLElement

  if (config.brandColor) {
    root.style.setProperty('--chat-brand', config.brandColor)
    root.style.setProperty('--chat-brand-hover', darken(config.brandColor, 10))
  }

  if (config.borderRadius) {
    root.style.setProperty('--chat-radius', config.borderRadius)
  }

  if (config.fontFamily) {
    root.style.setProperty('--chat-font', config.fontFamily)
  }
}
```

## Анимации

### Открытие Modal

```css
.chat-modal {
  animation: modalIn 0.3s ease-out;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

### Открытие Drawer

```css
.chat-drawer {
  animation: drawerIn 0.3s ease-out;
}

@keyframes drawerIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.chat-drawer-backdrop {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### Закрытие

```typescript
function closeWithAnimation(element: HTMLElement, callback: () => void) {
  element.style.animation = 'fadeOut 0.2s ease-in forwards'
  element.addEventListener('animationend', callback, { once: true })
}
```

## Адаптивность

### Mobile breakpoints

```css
/* Tablet */
@media (max-width: 768px) {
  .chat-modal {
    width: calc(100vw - 32px);
    height: calc(100vh - 120px);
    bottom: 80px;
    right: 16px;
  }
}

/* Mobile */
@media (max-width: 480px) {
  .chat-modal {
    width: 100vw;
    height: calc(100vh - 60px);
    bottom: 0;
    right: 0;
    border-radius: var(--chat-radius-lg) var(--chat-radius-lg) 0 0;
  }

  .chat-button {
    bottom: 16px;
    right: 16px;
    width: 52px;
    height: 52px;
  }
}
```

## Dark Mode (будущее)

```css
@media (prefers-color-scheme: dark) {
  :host {
    --chat-bg: #1e293b;
    --chat-bg-secondary: #334155;
    --chat-text: #f8fafc;
    --chat-text-secondary: #94a3b8;
    --chat-border: #475569;
  }
}
```

## Accessibility

```css
/* Focus visible */
.chat-input:focus-visible,
.chat-button:focus-visible,
.chat-send-button:focus-visible {
  outline: 2px solid var(--chat-brand);
  outline-offset: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* High contrast */
@media (prefers-contrast: high) {
  :host {
    --chat-border: #000000;
    --chat-text: #000000;
  }
}
```
