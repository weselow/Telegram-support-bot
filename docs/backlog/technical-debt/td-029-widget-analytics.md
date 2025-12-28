# TD-029: Chat Widget — Analytics интеграция

**Приоритет:** Low
**Статус:** Отложено
**Модуль:** chat-widget
**Источник:** Перенесено из chat-widget/docs/backlog/TD-004

## Описание

Интеграция с Яндекс.Метрикой и другими системами аналитики для отслеживания использования чата.

## События для трекинга

| Событие | Описание | Параметры |
|---------|----------|-----------|
| `chat_opened` | Пользователь открыл чат | `variant`, `source` |
| `chat_closed` | Пользователь закрыл чат | `duration`, `messages_count` |
| `message_sent` | Отправлено сообщение | `is_first_message` |
| `message_received` | Получено сообщение от оператора | — |
| `telegram_clicked` | Клик по ссылке Telegram | `is_linked` |
| `telegram_linked` | Telegram успешно подключен | — |

## Реализация

### Конфигурация

```typescript
interface WidgetConfig {
  // ... existing config
  analytics?: {
    enabled: boolean
    callback?: (event: string, data: Record<string, any>) => void
    yandexMetrikaId?: number
  }
}
```

### Модуль аналитики

```typescript
// chat-widget/src/utils/analytics.ts

export interface AnalyticsEvent {
  name: string
  data?: Record<string, any>
  timestamp: number
}

export class Analytics {
  constructor(private config: AnalyticsConfig) {}

  track(event: string, data?: Record<string, any>): void {
    if (!this.config.enabled) return

    // Custom callback
    if (this.config.callback) {
      this.config.callback(event, data || {})
    }

    // Yandex Metrika
    if (this.config.yandexMetrikaId && (window as any).ym) {
      (window as any).ym(this.config.yandexMetrikaId, 'reachGoal', event, data)
    }
  }
}
```

### Использование

```javascript
window.DellShopChatConfig = {
  analytics: {
    enabled: true,
    yandexMetrikaId: 12345678,
    callback: (event, data) => {
      console.log('Chat event:', event, data)
      // Custom analytics integration
    }
  }
}
```

## Связанные файлы

- `chat-widget/src/utils/analytics.ts` - новый файл (создать)
- `chat-widget/src/types/config.ts` - добавить analytics в конфиг
- `chat-widget/src/widget.ts` - интеграция событий
