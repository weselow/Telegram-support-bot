# Chat Widget — Интеграция

> Технический долг перенесён в основной backlog: TD-028 — TD-031

---

## Следующие шаги для интеграции

| # | Задача | Ответственный | Статус |
|---|--------|---------------|--------|
| 1 | ~~Реализовать API по спецификации [backend-api-spec.md](./backend-api-spec.md)~~ | Backend | DONE (задача 021) |
| 2 | ~~Настроить WebSocket сервер (`/ws/chat`)~~ | Backend | DONE (задача 021) |
| 3 | ~~Настроить раздачу статики виджета~~ | Backend | DONE (@fastify/static) |
| 4 | Добавить `<script>` тег на сайт dellshop.ru | Frontend | Ожидает |

---

## Архитектура деплоя

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser   │ ──── │    Caddy    │ ──── │     App     │
│             │      │ (HTTPS/TLS) │      │  (Fastify)  │
└─────────────┘      └─────────────┘      └─────────────┘
                                                 │
                          ┌──────────────────────┼──────────────────────┐
                          │                      │                      │
                    /chat-widget/*         /api/chat/*            /ws/chat
                    (static files)         (HTTP API)           (WebSocket)
```

### Сборка (автоматически в Dockerfile)
1. `widget-builder` stage компилирует `chat-widget/`
2. Результат копируется в `/app/public/chat-widget/`
3. `@fastify/static` раздаёт файлы по `/chat-widget/*`

### Доступные файлы
```
https://chat.dellshop.ru/chat-widget/chat-widget.js
https://chat.dellshop.ru/chat-widget/base.css
https://chat.dellshop.ru/chat-widget/modal.css
https://chat.dellshop.ru/chat-widget/drawer.css
```

### Подключение виджета на сайт

```html
<script
  src="https://chat.dellshop.ru/chat-widget.js"
  data-api-url="https://chat.dellshop.ru"
  data-ws-url="wss://chat.dellshop.ru/ws/chat"
  async
></script>
```

Или через конфигурацию:

```html
<script>
  window.DellShopChatConfig = {
    apiUrl: 'https://chat.dellshop.ru',
    wsUrl: 'wss://chat.dellshop.ru/ws/chat',
    variant: 'auto',
    sound: true,
    notifications: true
  }
</script>
<script src="https://chat.dellshop.ru/chat-widget.js" async></script>
```

---

## Технический долг (в основном backlog)

| ID | Описание | Приоритет |
|----|----------|-----------|
| [TD-028](../../backlog/technical-debt/td-028-widget-offline-mode.md) | Offline режим | High |
| [TD-029](../../backlog/technical-debt/td-029-widget-analytics.md) | Analytics интеграция | Low |
| [TD-030](../../backlog/technical-debt/td-030-widget-http-401-handling.md) | HTTP 401 handling | High |
| [TD-031](../../backlog/technical-debt/td-031-widget-http-429-handling.md) | HTTP 429 handling | Low |

---

## Решённые вопросы

| Вопрос | Решение | Дата |
|--------|---------|------|
| Один файл или несколько | Lazy CSS loading по variant | 2025-12-29 |
| Modal или Drawer | Оба варианта, переключаемые | 2025-12-29 |
| Bundler | esbuild | 2025-12-29 |
| Стили | CSS + отдельные CSS файлы | 2025-12-29 |
| Memory Management | maxMessages = 100 | 2025-12-29 |
| Backdrop blur | Добавлен для drawer | 2025-12-29 |
| window.DellShopChatConfig | Поддержка добавлена | 2025-12-29 |
| TD-002: Проверка активности вкладки | Звук только при hidden tab или закрытом чате | 2025-12-29 |
| TD-003: Browser Notifications | Уведомления при скрытой вкладке + config option | 2025-12-29 |
