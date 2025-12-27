# CI интеграция

**Дата:** 2025-12-27
**Источник:** TD-023

## Проблема

Отсутствовала CI интеграция — тесты и проверки не запускались автоматически при push/PR.

## Решение

Создан GitHub Actions workflow `.github/workflows/test.yml` с тремя jobs:

1. **lint-and-typecheck** — линтинг и проверка типов
2. **unit-tests** — юнит тесты (без Docker)
3. **integration-tests** — интеграционные тесты с PostgreSQL и Redis (через services)

### Особенности конфигурации

- **pnpm** вместо npm (через `pnpm/action-setup@v4`)
- **Node.js 22** (согласно package.json engines)
- **Prisma generate** перед тестами
- **PostgreSQL 16** и **Redis 7** как services для интеграционных тестов
- Порты: PostgreSQL 5433, Redis 6380 (как в локальном docker-compose)

## Изменённые файлы

- `.github/workflows/test.yml` — создан

## Важно для разработчика

**Триггеры CI:**
- Push в `main`
- Pull request в `main`

**Jobs выполняются параллельно:**
- `lint-and-typecheck` и `unit-tests` — быстрые, без внешних зависимостей
- `integration-tests` — с PostgreSQL и Redis services

**При добавлении новых тестов:**
- Unit тесты (`*.test.ts`) запускаются в `unit-tests` job
- Integration тесты (`*.integration.test.ts`) запускаются в `integration-tests` job
