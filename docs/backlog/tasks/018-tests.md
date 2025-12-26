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

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/018-tests
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/018-tests
```

### 3. Веди историю решений

В файле `docs/solutions/018-tests/decisions.md` записывай:
- Стратегия тестирования
- Как мокать Telegram API
- Тестовая БД (SQLite, Docker PostgreSQL)

### 4. Перед завершением — код-ревью

Запусти команду `/check-code` для проверки кода перед мержем.

### 5. По завершении

```bash
git add .
git commit -m "feat(018): тесты"
git checkout main
git merge feature/018-tests
```
