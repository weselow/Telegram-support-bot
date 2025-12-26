# Миграция с npm на pnpm

**Дата:** 2025-12-27
**Источник:** TD-026

## Проблема

npm медленно устанавливал зависимости и создавал большой node_modules с дублированием пакетов.

## Причина

npm копирует пакеты в node_modules каждого проекта, что приводит к дублированию и замедлению.

## Решение

Миграция на pnpm с использованием corepack для Docker.

**Ключевые изменения:**
- `pnpm.onlyBuiltDependencies` в package.json для Prisma build scripts
- `corepack enable && corepack prepare pnpm@latest --activate` в Dockerfile
- `pnpm exec` вместо `npx` в скриптах

## Изменённые файлы

- `package.json` — добавлена секция `pnpm.onlyBuiltDependencies`
- `pnpm-lock.yaml` — создан (заменил package-lock.json)
- `Dockerfile` — переход на pnpm через corepack
- `docker-entrypoint.sh` — `pnpm exec` вместо `npx`
- `docker-compose.override.yml` — pnpm в команде
- `CLAUDE.md` — команды обновлены на pnpm
- `docs/deployment/local-development.md` — инструкции обновлены

## Важно для разработчика

Использовать `pnpm` вместо `npm` для всех операций:
- `pnpm install` — установка зависимостей
- `pnpm run dev` — запуск в dev режиме
- `pnpm exec prisma ...` — запуск Prisma CLI
