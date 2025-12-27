# Тесты для website integration

**Дата:** 2025-12-27
**Источник:** TD-026

## Проблема

Компоненты website integration имели недостаточное покрытие тестами:
- `geoip.service.ts` — 0%
- `redirect-context.service.ts` — 0%
- `ask-support.ts` — 9.37%
- `start.ts` — 50%

## Решение

Написаны unit тесты для всех компонентов.

### geoip.service.test.ts (19 тестов)

- `isPrivateIp` — проверка всех приватных диапазонов (127.x, 10.x, 172.16-31.x, 192.168.x, IPv6)
- `getLocationByIp` — кэширование, API вызовы, обработка ошибок
- `extractCity` — приоритет city > settlement > region

### redirect-context.service.test.ts (6 тестов)

- `storeRedirectContext` — сохранение в Redis, обработка ошибок
- `getRedirectContext` — получение + удаление, обработка ошибок

### ask-support.test.ts (6 тестов)

- `getRedirectData` — атомарное получение + удаление, обработка невалидного JSON

### start.test.ts (добавлено 6 тестов)

- Payload handling — валидный payload с данными, без данных, невалидный формат
- Partial fields — обработка null полей

## Результаты

| Файл | Было | Стало | Тестов |
|------|------|-------|--------|
| `start.ts` | 50% | 100% | +6 |
| `ask-support.ts` | 9.37% | 37.5% | +6 |
| `geoip.service.ts` | - | - | +19 |
| `redirect-context.service.ts` | - | - | +6 |

**Всего:** +37 тестов (96 → 133)

## Изменённые файлы

- `src/services/__tests__/geoip.service.test.ts` — создан
- `src/services/__tests__/redirect-context.service.test.ts` — создан
- `src/http/routes/__tests__/ask-support.test.ts` — создан
- `src/bot/handlers/__tests__/start.test.ts` — расширен

## Важно для разработчика

`geoip.service` и `redirect-context.service` исключены из coverage отчёта в `vitest.config.ts` (вместе с `src/services/**`), но тесты существуют и выполняются.

Для добавления их в coverage — убрать `'src/services/**'` из exclude и добавить конкретные файлы.
