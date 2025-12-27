# TD-027: Мониторинг silent failures

**Приоритет:** MEDIUM
**Источник:** Task 019 code review
**Дата:** 2024-12-27

## Проблема

Website integration использует паттерн "graceful degradation" — при ошибках Redis/API возвращается null и работа продолжается. Это правильное поведение, но без мониторинга невозможно обнаружить деградацию.

## Места с silent failures

| Файл | Строки | Описание |
|------|--------|----------|
| `ask-support.ts` | 48-54 | Redis save failure |
| `ask-support.ts` | 66-77 | Redis read failure |
| `geoip.service.ts` | 47-59 | Cache read failure |
| `geoip.service.ts` | 89-94 | Cache write failure |
| `geoip.service.ts` | 100-103 | DaData API failure |
| `redirect-context.service.ts` | 21-26 | Context store failure |
| `redirect-context.service.ts` | 35-48 | Context read failure |

## Решение

### Вариант 1: Sentry breadcrumbs + custom metrics

```typescript
// При каждом failure добавлять breadcrumb
addBreadcrumb('redis', 'Cache write failed', 'warning', { key, error });

// Периодически отправлять метрики
Sentry.metrics.increment('geoip.cache_miss');
Sentry.metrics.increment('geoip.api_error');
```

### Вариант 2: Prometheus metrics

```typescript
const cacheHits = new Counter({ name: 'geoip_cache_hits_total' });
const cacheMisses = new Counter({ name: 'geoip_cache_misses_total' });
const apiErrors = new Counter({ name: 'geoip_api_errors_total' });
```

## Алерты

- `geoip_api_errors_total > 10/min` — DaData проблемы
- `redis_errors_total > 50/min` — Redis проблемы
- `context_store_failures > 20%` — потеря данных пользователей

## Definition of Done

- [ ] Выбран подход (Sentry/Prometheus)
- [ ] Добавлены метрики во все точки failure
- [ ] Настроены алерты
- [ ] Дашборд для мониторинга
