# Задача 003: Prisma-схема и миграции

**Этап:** 1 - Фундамент
**Статус:** DONE
**Приоритет:** Высокий

## Описание

Создать схему базы данных с помощью Prisma ORM.

## Подзадачи

- [x] Инициализация Prisma (`npx prisma init`)
- [x] Создание схемы в schema.prisma:
  - [x] Модель User (tg_user_id, tg_username, tg_first_name, topic_id, status, phone, source_url, timestamps)
  - [x] Модель TicketEvent (user_id, event_type, old_value, new_value, question, source_url, created_at)
  - [x] Модель MessageMap (user_id, dm_message_id, topic_message_id, direction, created_at)
  - [x] Enum для status (new, in_progress, waiting_client, closed)
  - [x] Enum для event_type (opened, reopened, closed, status_changed, phone_updated)
  - [x] Enum для direction (user_to_support, support_to_user)
- [x] Создание первой миграции
- [x] Генерация Prisma Client
- [ ] Создание seed-скрипта (опционально)

## Зависимости

- [002-docker-setup](./002-docker-setup.md) (PostgreSQL должен быть запущен)

## Результат

- Миграции применяются без ошибок
- Prisma Client генерируется
- Можно создавать/читать записи через Prisma

---

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/003-database-schema
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/003-database-schema
```

### 3. Веди историю решений

В файле `docs/solutions/003-database-schema/decisions.md` записывай:
- Выбор типов данных
- Индексы и их обоснование
- Изменения схемы в процессе разработки

### 4. По завершении

```bash
git add .
git commit -m "feat(003): prisma-схема и миграции"
git checkout main
git merge feature/003-database-schema
```
