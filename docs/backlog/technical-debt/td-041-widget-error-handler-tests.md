# TD-041: Widget Error Logger — тесты globalErrorHandler

**Дата:** 2025-12-30
**Приоритет:** Средний
**Сложность:** Низкая (1-2 часа)
**Источник:** Code review TD-037

## Проблема

Текущее тестовое покрытие error-logger.ts составляет ~85%. Не покрыты тестами:
- `globalErrorHandler` (window.onerror)
- `rejectionHandler` (unhandledrejection)
- `maxQueueSize` overflow

## Что нужно протестировать

### 1. globalErrorHandler (window.onerror)

```typescript
it('should filter Script error. messages (cross-origin)', async () => {
  // Trigger global error with 'Script error.' message
  // Verify it's NOT sent to backend
})

it('should include filename, lineno, colno in context', async () => {
  // Trigger global error with full ErrorEvent
  // Verify context contains file info
})

it('should handle ErrorEvent with error object', async () => {
  // Trigger error with event.error present
  // Verify stack trace is captured
})
```

### 2. rejectionHandler (unhandledrejection)

```typescript
it('should log unhandled promise rejections', async () => {
  // Trigger Promise.reject without catch
  // Verify error is captured with 'Unhandled rejection:' prefix
})

it('should handle rejection with Error object', async () => {
  // Reject with new Error()
  // Verify stack trace is captured
})

it('should handle rejection with primitive value', async () => {
  // Reject with string/number
  // Verify message is captured
})
```

### 3. maxQueueSize

```typescript
it('should drop errors when queue is full', async () => {
  // Fill queue to maxQueueSize
  // Add one more error
  // Verify it's dropped
})
```

## Файлы для изменения

- `chat-widget/src/__tests__/utils/error-logger.test.ts`

## Метрики успеха

- Покрытие error-logger.ts >95%
- Все новые тесты проходят
