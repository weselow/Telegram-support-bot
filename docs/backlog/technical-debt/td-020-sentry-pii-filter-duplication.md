# TD-020: Дублирование логики фильтрации PII в Sentry

## Проблема

Логика фильтрации PII (`key !== 'phone' && key !== 'tgPhone'`) дублируется в четырёх местах в `src/config/sentry.ts`.

## Текущее поведение

```typescript
// В beforeSend
delete event.extra.phone;
delete event.extra.tgPhone;

// В captureError
if (key !== 'phone' && key !== 'tgPhone') { ... }

// В setUserContext
if (key !== 'phone' && key !== 'tgPhone') { ... }

// В addBreadcrumb
.filter(([key]) => key !== 'phone' && key !== 'tgPhone')
```

## Последствия

- При добавлении нового PII-поля нужно менять 4 места
- Риск пропустить одно из мест при обновлении

## Предлагаемое решение

```typescript
const PII_KEYS = ['phone', 'tgPhone'] as const;

function filterPII(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => !PII_KEYS.includes(key as any))
  );
}
```

## Приоритет

Низкий — текущая реализация корректна, улучшение maintainability.

## Источник

Type design review для задачи 016.
