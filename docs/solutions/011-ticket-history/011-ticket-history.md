# Задача 011: История событий тикета

**Этап:** 3 - Расширенный функционал
**Статус:** DONE
**Приоритет:** Средний

## Описание

Записывать все события тикета в ticket_events для истории обращений.

## Подзадачи

- [x] Запись событий:
  - [x] opened — первое обращение (с question и source_url)
  - [x] reopened — переоткрытие (с новым question)
  - [x] closed — закрытие
  - [x] status_changed — смена статуса (old_value → new_value)
  - [x] phone_updated — обновление телефона
- [x] Логика переоткрытия:
  - [x] При сообщении в закрытый тикет → событие "reopened"
  - [x] Запрос подтверждения телефона
- [ ] Возможность просмотра истории (опционально):
  - [ ] Команда /history для сотрудников в топике?

## Зависимости

- [003-database-schema](./003-database-schema.md)
- [010-auto-status-change](./010-auto-status-change.md)

## Результат

- Все события сохраняются в БД
- Можно восстановить историю обращений пользователя
- При переоткрытии запрашивается подтверждение телефона

---

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/011-ticket-history
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/011-ticket-history
```

### 3. Веди историю решений

В файле `docs/solutions/011-ticket-history/decisions.md` записывай:
- Какие данные хранить в old_value/new_value
- Формат хранения question
- Нужен ли просмотр истории через бота

### 4. По завершении

```bash
git add .
git commit -m "feat(011): история событий тикета"
git checkout main
git merge feature/011-ticket-history
```
