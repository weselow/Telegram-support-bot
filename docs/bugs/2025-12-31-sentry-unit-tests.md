# Unit-тесты для sentry.ts (фильтрация PII)

**Дата:** 2025-12-31
**Источник:** TD-043

## Проблема

Файл `src/config/sentry.ts` не был покрыт тестами. Содержит критическую логику:
- Фильтрация персональных данных (`phone`, `tgPhone`)
- Graceful degradation при ошибках Sentry SDK
- 4 публичные функции: `captureError`, `setUserContext`, `addBreadcrumb`, `captureMessage`

## Риски без тестов

1. **Утечка PII** — если фильтрация сломается, персональные данные попадут в Sentry
2. **Падение приложения** — ошибки Sentry SDK могут прервать основной поток

## Решение

Создан файл `src/config/__tests__/sentry.test.ts` с 22 тестами:

### captureError (5 тестов)
- Захват исключения с контекстом
- Фильтрация `phone` из контекста
- Фильтрация `tgPhone` из контекста
- Обработка undefined контекста
- Graceful degradation при ошибке SDK

### setUserContext (5 тестов)
- Установка user ID
- Установка extra данных
- Фильтрация `phone` из extra
- Фильтрация `tgPhone` из extra
- Graceful degradation при ошибке SDK

### addBreadcrumb (6 тестов)
- Добавление breadcrumb с category и message
- Кастомный level
- Добавление data
- Фильтрация `phone` из data
- Фильтрация `tgPhone` из data
- Graceful degradation при ошибке SDK

### captureMessage (6 тестов)
- Захват сообщения с default error level
- Кастомный level
- Установка tags
- Фильтрация `phone` из контекста
- Фильтрация `tgPhone` из контекста
- Graceful degradation при ошибке SDK

## Изменённые файлы

- Создан: `src/config/__tests__/sentry.test.ts` — 22 теста

## Технические детали

Тесты используют Vitest с моками:
- `@sentry/node` — мок всего модуля
- `./env.js` — мок с `SENTRY_DSN` для инициализации

Ключевой паттерн — отслеживание вызовов `scope.setExtra()` через callback:
```typescript
let scopeCallbacks: Array<(scope: MockScope) => void> = [];

vi.mock('@sentry/node', () => ({
  withScope: vi.fn((callback) => {
    scopeCallbacks.push(callback);
    callback(createMockScope());
  }),
  // ...
}));
```

## Результаты

- Всего тестов: 22
- Все тесты проходят
- Покрытие критической логики фильтрации PII: 100%
