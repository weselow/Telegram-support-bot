# TD-026: Миграция с npm на pnpm

**Тип:** Технический долг (инфраструктура)
**Статус:** DONE
**Приоритет:** Низкий

## Описание

Миграция с npm на pnpm для ускорения установки зависимостей и экономии дискового пространства.

## Выполнено

- [x] Удаление node_modules и package-lock.json
- [x] Установка зависимостей через pnpm
- [x] Настройка `pnpm.onlyBuiltDependencies` для Prisma
- [x] Обновление Dockerfile (corepack + pnpm)
- [x] Обновление docker-entrypoint.sh
- [x] Обновление docker-compose.override.yml
- [x] Обновление документации (CLAUDE.md, local-development.md)
- [x] Тестирование локального запуска
- [x] Тестирование Docker-сборки

## Изменённые файлы

- `package.json` — добавлена секция `pnpm.onlyBuiltDependencies`
- `pnpm-lock.yaml` — создан (заменил package-lock.json)
- `Dockerfile` — переход на pnpm через corepack
- `docker-entrypoint.sh` — `pnpm exec` вместо `npx`
- `docker-compose.override.yml` — pnpm в команде
- `CLAUDE.md` — команды обновлены на pnpm
- `docs/deployment/local-development.md` — инструкции обновлены

## Результат

- Все тесты проходят (`pnpm test`)
- Docker-образ собирается успешно
- Бот запускается корректно
