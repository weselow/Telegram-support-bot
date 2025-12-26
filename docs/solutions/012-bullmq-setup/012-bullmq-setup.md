# Задача 012: BullMQ + Redis интеграция

**Этап:** 4 - SLA и автоматизация
**Статус:** DONE
**Приоритет:** Средний

## Описание

Настроить BullMQ для фоновых задач (SLA-таймеры, автозакрытие).

## Подзадачи

- [x] Подключение к Redis (src/config/redis.ts)
- [x] Создание очередей:
  - [x] sla-queue — для SLA-напоминаний
  - [x] autoclose-queue — для автозакрытия
- [x] Базовая структура воркеров (src/jobs/):
  - [x] Инициализация воркеров
  - [x] Graceful shutdown
- [x] Утилиты для работы с очередями:
  - [x] Добавление задачи с задержкой
  - [x] Отмена задачи
- [x] Интеграция с основным приложением

## Зависимости

- [002-docker-setup](../002-docker-setup/002-docker-setup.md) (Redis)
- [004-basic-bot](../004-basic-bot/004-basic-bot.md)

## Результат

- BullMQ подключен к Redis
- Очереди созданы и готовы к использованию
- Воркеры запускаются вместе с ботом

---

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/012-bullmq-setup
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/012-bullmq-setup
```

### 3. Веди историю решений

В файле `docs/solutions/012-bullmq-setup/decisions.md` записывай:
- Структура очередей
- Настройки повторных попыток
- Стратегия обработки ошибок

### 4. По завершении

```bash
git add .
git commit -m "feat(012): BullMQ + Redis интеграция"
git checkout main
git merge feature/012-bullmq-setup
```
