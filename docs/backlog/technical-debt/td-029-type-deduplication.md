# TD-029: Устранение дублирования типов

**Приоритет:** LOW
**Источник:** Task 019 code review
**Дата:** 2024-12-27

## Проблема

`RedirectData` и `UserRedirectContext` содержат практически одинаковые поля:

```typescript
// ask-support.ts
interface RedirectData {
  ip: string;
  sourceUrl: string | null;
  city: string | null;
  geoipResponse: DaDataLocation | null;
  createdAt: string;
}

// redirect-context.service.ts
interface UserRedirectContext {
  sourceUrl: string | null;
  sourceCity: string | null;  // vs city
  ip: string | null;          // vs ip: string
  geoipResponse: DaDataLocation | null;
}
```

## Различия

| Поле | RedirectData | UserRedirectContext |
|------|-------------|---------------------|
| ip | `string` (required) | `string \| null` |
| city | `city` | `sourceCity` |
| createdAt | present | absent |

## Варианты решения

### Вариант 1: Базовый тип + расширения

```typescript
// src/types/redirect.ts
interface BaseRedirectContext {
  sourceUrl: string | null;
  city: string | null;
  geoipResponse: DaDataLocation | null;
}

interface RedirectData extends BaseRedirectContext {
  ip: string;
  createdAt: string;
}

interface UserRedirectContext extends BaseRedirectContext {
  ip: string | null;
}
```

### Вариант 2: Pick + Partial

```typescript
type UserRedirectContext = Partial<Pick<RedirectData, 'ip' | 'sourceUrl' | 'city' | 'geoipResponse'>>;
```

### Вариант 3: Оставить как есть

Разные контексты использования (HTTP vs Bot) могут оправдывать разные типы.

## Рекомендация

Вариант 3 — оставить как есть. Типы используются в разных слоях, дублирование минимально (4 поля), рефакторинг даст маленький выигрыш.

## Definition of Done

- [ ] Решение принято
- [ ] Если рефакторинг — типы объединены
- [ ] Тесты проходят
