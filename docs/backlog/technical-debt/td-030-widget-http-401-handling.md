# TD-030: Chat Widget — Обработка HTTP 401 ошибки

**Приоритет:** High
**Статус:** Отложено (требует backend интеграции)
**Модуль:** chat-widget
**Источник:** Перенесено из chat-widget/docs/backlog/TD-005

## Описание проблемы

Согласно `backend-api-spec.md`, при получении HTTP 401 (сессия не найдена) клиент должен автоматически вызвать `/api/chat/init` для восстановления сессии.

Текущая реализация в `transport/http.ts:48-51` просто выбрасывает `ChatHttpError`, не пытаясь восстановить сессию.

## Текущий код

```typescript
// chat-widget/src/transport/http.ts
if (!response.ok) {
  const text = await response.text().catch(() => 'Unknown error')
  throw new ChatHttpError(response.status, text)
}
```

## Предлагаемое решение

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await this.fetchWithRetry(endpoint, options)
  return response.json()
}

private async fetchWithRetry(
  endpoint: string,
  options: RequestInit,
  retried = false
): Promise<Response> {
  const url = `${this.baseUrl}${endpoint}`

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  // Автоматический retry при 401
  if (response.status === 401 && !retried) {
    await this.init() // Переинициализация сессии
    return this.fetchWithRetry(endpoint, options, true)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error')
    throw new ChatHttpError(response.status, text)
  }

  return response
}
```

## Когда реализовывать

При интеграции с реальным backend, когда можно протестировать сценарий:
1. Сессия истекла
2. Запрос возвращает 401
3. Клиент вызывает `/api/chat/init`
4. Повторный запрос успешен

## Связанные файлы

- `chat-widget/src/transport/http.ts`
- `docs/modules/chat-widget/backend-api-spec.md` (секция "HTTP ошибки")
