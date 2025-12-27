# Исправление уровней логирования

**Дата:** 2025-12-27
**Источник:** TD-028

## Проблема

Redis ошибки логировались на уровне `warn`, что не триггерило алерты Sentry.

## Решение

Изменён уровень логирования с `warn` → `error` для реальных ошибок:

| Файл | Сообщение |
|------|-----------|
| `geoip.service.ts:58` | Failed to read GeoIP cache |
| `geoip.service.ts:93` | Failed to cache GeoIP response |
| `redirect-context.service.ts:26` | Failed to store redirect context |
| `redirect-context.service.ts:47` | Failed to get redirect context |

## Что НЕ реализовано

- **Error IDs** — избыточно для текущего масштаба, сохранено в `prometheus-grafana-monitoring.md`

## Изменённые файлы

- `src/services/geoip.service.ts` — warn → error (2 места)
- `src/services/redirect-context.service.ts` — warn → error (2 места)
- `src/services/__tests__/redirect-context.service.test.ts` — обновлены тесты
