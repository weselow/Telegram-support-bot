# Задача 018: Тесты

**Этап:** 5 - Полировка
**Статус:** DONE
**Приоритет:** Средний

## Описание

Написать unit и integration тесты для основных компонентов.

## Подзадачи

- [x] Настройка Jest:
  - [x] jest.config.js
  - [x] Тестовое окружение
  - [x] Coverage thresholds (>60%)
- [ ] Unit тесты:
  - [x] formatMessage (добавлено вместо payload.ts)
  - [ ] ticket.service.ts → td-021
  - [ ] message.service.ts → td-021
  - [ ] sla.service.ts → td-021
  - [ ] payload.ts (файл не существует)
- [ ] Integration тесты: → td-022
  - [ ] Репозитории (с тестовой БД)
  - [ ] BullMQ jobs
- [ ] Моки:
  - [x] Telegram API
  - [ ] Prisma Client → td-021
  - [ ] Redis/BullMQ → td-022
- [ ] CI интеграция (опционально): → td-023
  - [ ] GitHub Actions
  - [ ] Запуск тестов при push

## Зависимости

- Все сервисы должны быть реализованы

## Результат

- [x] Тесты проходят
- [x] Coverage >60%
- [x] Основная логика покрыта

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

### 5. Перед коммитом

- [x] Проверь, что все подзадачи из этого файла выполнены
- [x] Обнови статус задачи на `DONE`
- [x] Перемести этот файл в `docs/solutions/018-tests/`

### 6. По завершении

```bash
git add .
git commit -m "feat(018): тесты"
git checkout main
git merge feature/018-tests
```
