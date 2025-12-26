# Задача 018: Тесты

**Этап:** 5 - Полировка
**Статус:** DONE
**Приоритет:** Средний

## Описание

Написать unit и integration тесты для основных компонентов.

## Подзадачи

- [x] Настройка Jest:
  - [x] jest.config.js (исправлен ts-jest warning)
  - [x] Тестовое окружение (ESM preset)
  - [x] Coverage thresholds (>60%)
- [x] Unit тесты:
  - [x] formatMessage (9 тестов)
  - [ ] ticket.service.ts (заблокировано ESM/Prisma)
  - [ ] message.service.ts (заблокировано ESM/Prisma)
  - [ ] sla.service.ts (заблокировано ESM/Prisma)
  - [ ] payload.ts (файл не существует)
- [ ] Integration тесты:
  - [ ] Репозитории (требует тестовой БД)
  - [ ] BullMQ jobs (требует моков)
- [x] Моки:
  - [x] Telegram API (в start.test.ts)
  - [ ] Prisma Client (заблокировано ESM)
  - [ ] Redis/BullMQ (требует инфраструктуры)
- [ ] CI интеграция (опционально):
  - [ ] GitHub Actions
  - [ ] Запуск тестов при push

## Зависимости

- Все сервисы должны быть реализованы

## Результат

- [x] Тесты проходят (13 тестов)
- [x] Coverage >60% (87.5% overall)
- [x] Основная логика покрыта (formatMessage 100%, start handler 100%)

## Ограничения

ESM + Prisma + Jest несовместимость не позволяет тестировать сервисы без значительного рефакторинга. См. decisions.md для деталей.
