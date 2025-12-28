# TD-031: Chat Widget — Обработка HTTP 429 (Rate Limit)

**Приоритет:** Low
**Статус:** Отложено (требует backend интеграции)
**Модуль:** chat-widget
**Источник:** Перенесено из chat-widget/docs/backlog/TD-006

## Описание проблемы

Согласно `backend-api-spec.md`, при получении HTTP 429 (rate limit) нужно показать пользователю сообщение "Подождите...".

Текущая реализация имеет client-side rate limiting (20 сообщений в минуту), но серверный 429 не обрабатывается специально.

## Текущий код

```typescript
// chat-widget/src/transport/http.ts
if (!response.ok) {
  const text = await response.text().catch(() => 'Unknown error')
  throw new ChatHttpError(response.status, text)
}
```

## Предлагаемое решение

### Вариант 1: Специальная обработка в HTTP клиенте

```typescript
// chat-widget/src/transport/http.ts
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  throw new RateLimitError(
    'Слишком много запросов. Подождите немного.',
    retryAfter ? parseInt(retryAfter, 10) : 60
  )
}
```

### Вариант 2: Обработка в widget.ts

```typescript
// chat-widget/src/widget.ts
} catch (error) {
  if (error instanceof ChatHttpError && error.status === 429) {
    this.statusBar?.show('error', 'Слишком много запросов. Подождите немного.')
    return
  }
  // ... остальная обработка
}
```

## Почему отложено

1. Client-side rate limiting уже реализован (20 msg/min)
2. При соблюдении лимитов серверный 429 маловероятен
3. Требует тестирования с реальным backend

## Связанные файлы

- `chat-widget/src/transport/http.ts`
- `chat-widget/src/widget.ts`
- `docs/modules/chat-widget/backend-api-spec.md` (секция "HTTP ошибки")
