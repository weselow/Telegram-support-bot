# Задача 003: Prisma-схема и миграции

**Этап:** 1 - Фундамент
**Статус:** TODO
**Приоритет:** Высокий

## Описание

Создать схему базы данных с помощью Prisma ORM.

## Подзадачи

- [ ] Инициализация Prisma (`npx prisma init`)
- [ ] Создание схемы в schema.prisma:
  - [ ] Модель User (tg_user_id, tg_username, tg_first_name, topic_id, status, phone, source_url, timestamps)
  - [ ] Модель TicketEvent (user_id, event_type, old_value, new_value, question, source_url, created_at)
  - [ ] Модель MessageMap (user_id, dm_message_id, topic_message_id, direction, created_at)
  - [ ] Enum для status (new, in_progress, waiting_client, closed)
  - [ ] Enum для event_type (opened, reopened, closed, status_changed, phone_updated)
  - [ ] Enum для direction (user_to_support, support_to_user)
- [ ] Создание первой миграции
- [ ] Генерация Prisma Client
- [ ] Создание seed-скрипта (опционально)

## Зависимости

- [002-docker-setup](./002-docker-setup.md) (PostgreSQL должен быть запущен)

## Результат

- Миграции применяются без ошибок
- Prisma Client генерируется
- Можно создавать/читать записи через Prisma

---

## История решений

> При начале работы над задачей создай папку:
> `docs/solutions/003-database-schema/`
>
> В ней веди файл `decisions.md` с историей принятых решений:
> - Выбор типов данных
> - Индексы и их обоснование
> - Изменения схемы в процессе разработки
