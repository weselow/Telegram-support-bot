# Задача 018: Тесты

**Этап:** 5 - Полировка
**Статус:** TODO
**Приоритет:** Средний

## Описание

Написать unit и integration тесты для основных компонентов.

## Подзадачи

- [ ] Настройка Jest:
  - [ ] jest.config.js
  - [ ] Тестовое окружение
  - [ ] Coverage thresholds (>60%)
- [ ] Unit тесты:
  - [ ] ticket.service.ts
  - [ ] message.service.ts
  - [ ] sla.service.ts
  - [ ] payload.ts (декодирование base64url)
- [ ] Integration тесты:
  - [ ] Репозитории (с тестовой БД)
  - [ ] BullMQ jobs
- [ ] Моки:
  - [ ] Telegram API
  - [ ] Prisma Client
  - [ ] Redis/BullMQ
- [ ] CI интеграция (опционально):
  - [ ] GitHub Actions
  - [ ] Запуск тестов при push

## Зависимости

- Все сервисы должны быть реализованы

## Результат

- Тесты проходят
- Coverage >60%
- Основная логика покрыта

---

## История решений

> При начале работы над задачей создай папку:
> `docs/solutions/018-tests/`
>
> В ней веди файл `decisions.md` с историей принятых решений:
> - Стратегия тестирования
> - Как мокать Telegram API
> - Тестовая БД (SQLite, Docker PostgreSQL)
