# TD-043: Unit-тесты для src/config/sentry.ts

**Дата:** 2025-12-31
**Приоритет:** Высокий
**Сложность:** Средняя (2-3 часа)
**Источник:** Code review PR

## Проблема

Файл `src/config/sentry.ts` не покрыт тестами. Содержит критическую логику:
- Фильтрация персональных данных (`phone`, `tgPhone`) в `beforeSend`
- Graceful degradation при ошибках Sentry SDK
- Функции `captureError`, `setUserContext`, `captureMessage`

## Риски без тестов

1. **Утечка PII** — если фильтрация сломается, персональные данные попадут в Sentry
2. **Падение приложения** — ошибки Sentry SDK могут прервать основной поток
3. **Неверная инициализация** — в разных окружениях может работать некорректно

## Что нужно протестировать

### 1. Фильтрация PII в beforeSend

```typescript
it('should filter phone from user context', () => {
  // Verify phone and tgPhone are removed
})

it('should filter phone from extra context', () => {
  // Verify sensitive fields removed from extra
})
```

### 2. Graceful degradation

```typescript
it('should not throw when Sentry SDK fails', () => {
  // Mock Sentry to throw, verify no exception propagates
})

it('should skip operations when not initialized', () => {
  // Call functions before init, verify no errors
})
```

### 3. captureMessage уровни

```typescript
it('should set correct severity level', () => {
  // Test 'error', 'warning', 'info' levels
})
```

## Файлы для изменения

- Создать: `src/config/__tests__/sentry.test.ts`

## Метрики успеха

- Покрытие sentry.ts >80%
- Тесты на фильтрацию PII проходят
- Все существующие тесты проходят
