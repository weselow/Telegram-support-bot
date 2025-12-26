# TD-022: Integration тесты

**Источник:** Задача 018
**Приоритет:** Низкий
**Блокер:** Требует инфраструктуры

## Описание

Не реализованы integration тесты:
- Репозитории (с тестовой БД)
- BullMQ jobs

## Причина

1. **Тестовая БД:** SQLite несовместим с некоторыми типами PostgreSQL (BigInt). Docker PostgreSQL добавляет сложность.
2. **BullMQ:** Требует запущенный Redis или сложные моки.

## Варианты решения

1. **Testcontainers** - Docker-контейнеры для тестов
2. **In-memory Redis** - ioredis-mock для BullMQ
3. **Отдельный docker-compose.test.yml** - изолированное тестовое окружение

## Связанные файлы

- src/db/repositories/*.ts
- src/jobs/*.ts
