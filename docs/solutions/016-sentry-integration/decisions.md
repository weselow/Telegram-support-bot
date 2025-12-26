# Decisions: Sentry Integration

## Архитектура

### Подход к интеграции

**Решение:** Отдельный модуль `src/config/sentry.ts` для инициализации + ручные вызовы `captureException`

**Альтернативы:**
1. pino-sentry transport — автоматически, но меньше контроля
2. Только глобальные handlers — упустим контекст
3. **Выбрано:** Ручная интеграция — полный контроль над контекстом и данными

### Инициализация

Sentry должен инициализироваться первым в `index.ts`:
```typescript
import './config/sentry.js'; // Первый импорт
import { ... } from 'grammy';
```

## Что логировать

### Ошибки (captureException)

| Источник | Пример | Контекст |
|----------|--------|----------|
| Telegram API | Ошибки отправки сообщений | userId, topicId, action |
| Database | Prisma errors | userId, operation |
| Workers | BullMQ job failures | jobId, jobType, data |
| Unhandled | process.on('uncaughtException') | stack |

### Breadcrumbs (события)

| Событие | Категория | Level |
|---------|-----------|-------|
| Входящее сообщение | message | info |
| Создание топика | topic | info |
| Смена статуса | status | info |
| SLA reminder | sla | warning |
| Autoclose | autoclose | info |

## Privacy / PII

**Не отправлять в Sentry:**
- Телефоны пользователей
- Содержимое сообщений
- Токен бота

**Отправлять:**
- userId (внутренний, не telegram id)
- topicId
- Статусы
- Типы действий

## Конфигурация

```typescript
Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  release: `telegram-support-bot@${version}`,
  tracesSampleRate: 0.1, // 10% для performance
  beforeSend: (event) => {
    // Sanitize PII
    return event;
  },
});
```

## Файлы

| Файл | Изменения |
|------|-----------|
| src/config/sentry.ts | NEW: инициализация |
| src/index.ts | Импорт sentry первым |
| src/bot/handlers/*.ts | captureException в catch |
| src/jobs/*.worker.ts | captureException в catch |
