# TD-028: Пересмотр уровней логирования

**Приоритет:** LOW
**Источник:** Task 019 code review
**Дата:** 2024-12-27

## Проблема

Некоторые реальные ошибки логируются на уровне `warn`, что может не триггерить алерты. Также отсутствуют Error IDs для трекинга в Sentry.

## Текущее состояние

| Файл | Уровень | Сообщение | Проблема |
|------|---------|-----------|----------|
| `geoip.service.ts:58` | warn | Failed to read GeoIP cache | Реальная ошибка Redis |
| `geoip.service.ts:93` | warn | Failed to cache GeoIP response | Реальная ошибка Redis |
| `redirect-context.service.ts:25` | warn | Failed to store redirect context | Потеря данных пользователя |
| `redirect-context.service.ts:46` | warn | Failed to get redirect context | Потеря данных пользователя |

## Решение

### 1. Пересмотр уровней

```typescript
// Было
logger.warn({ error, ip }, 'Failed to read GeoIP cache');

// Стало
logger.error({ error, ip }, 'Failed to read GeoIP cache');
```

### 2. Добавить Error IDs

Создать `src/constants/errorIds.ts`:

```typescript
export const ErrorIds = {
  GEOIP_CACHE_READ_FAILED: 'GEOIP_001',
  GEOIP_CACHE_WRITE_FAILED: 'GEOIP_002',
  GEOIP_API_FAILED: 'GEOIP_003',
  REDIRECT_STORE_FAILED: 'REDIRECT_001',
  REDIRECT_READ_FAILED: 'REDIRECT_002',
} as const;
```

Использование:
```typescript
logger.error({ error, ip, errorId: ErrorIds.GEOIP_CACHE_READ_FAILED }, 'Failed to read GeoIP cache');
captureError(error, { errorId: ErrorIds.GEOIP_CACHE_READ_FAILED });
```

## Definition of Done

- [ ] Уровни логирования пересмотрены
- [ ] Error IDs добавлены
- [ ] Sentry группирует ошибки по ID
