# TD-026: Тесты для website integration

**Приоритет:** HIGH
**Источник:** Task 019 code review
**Дата:** 2024-12-27

## Проблема

Новые компоненты website integration имеют недостаточное покрытие тестами:
- `geoip.service.ts` — 0% покрытия
- `redirect-context.service.ts` — 0% покрытия
- `ask-support.ts` — 0% покрытия (только isBot протестирован)
- `start.ts` — payload handling не покрыт

## Требуемые тесты

### 1. geoip.service.test.ts

```typescript
describe('isPrivateIp', () => {
  // 127.x.x.x (localhost)
  // 10.x.x.x (Class A)
  // 172.16-31.x.x (Class B)
  // 192.168.x.x (Class C)
  // IPv6 local (::1, fe80:, fc00:, fd00:)
});

describe('extractCity', () => {
  // city > settlement > region priority
  // all null returns null
});

describe('getLocationByIp', () => {
  // API key missing → null
  // Private IP → null (no API call)
  // Cache hit → returns cached
  // Cache miss → calls API, caches result
  // API error → returns null
});
```

### 2. redirect-context.service.test.ts

```typescript
describe('storeRedirectContext', () => {
  // Success path
  // Redis failure → logs warn, does not throw
});

describe('getRedirectContext', () => {
  // Found → returns and deletes
  // Not found → returns null
  // Redis failure → returns null, logs warn
});
```

### 3. ask-support.test.ts (integration)

```typescript
describe('GET /ask-support', () => {
  // Bot User-Agent → 403
  // Valid browser → 302 redirect to t.me
  // Redis failure → still redirects
});

describe('getRedirectData', () => {
  // Found → returns data (atomic delete)
  // Not found → returns null
  // Invalid JSON → returns null
});
```

### 4. start.test.ts (дополнить)

```typescript
describe('payload handling', () => {
  // Valid payload + redirect data → stores context
  // Valid payload + no data → logs debug
  // Invalid payload format → skips lookup
  // No payload → normal welcome
});
```

## Definition of Done

- [ ] Все тесты написаны и проходят
- [ ] Coverage >60% для каждого файла
- [ ] Моки Redis изолированы
