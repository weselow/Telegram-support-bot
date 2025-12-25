# Задача 002: Docker-композиция

**Этап:** 1 - Фундамент
**Статус:** DONE
**Приоритет:** Высокий

## Описание

Настроить Docker-окружение для разработки и продакшена.

## Подзадачи

- [x] Создание Dockerfile для Node.js приложения
- [x] Создание docker-compose.yml с сервисами:
  - [x] app (Node.js бот)
  - [x] postgres (PostgreSQL 16)
  - [x] redis (Redis 7)
- [x] Настройка volumes для персистентности данных
- [x] Настройка networks
- [x] Создание docker-compose.override.yml для dev-режима
- [x] Проверка запуска всех сервисов

## Зависимости

- [001-project-init](./001-project-init.md)

## Результат

- `docker-compose up` запускает все сервисы
- PostgreSQL доступен на localhost:5432
- Redis доступен на localhost:6379
- Приложение перезапускается при изменении кода (dev-режим)

---

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/002-docker-setup
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/002-docker-setup
```

### 3. Веди историю решений

В файле `docs/solutions/002-docker-setup/decisions.md` записывай:
- Выбор базовых образов
- Настройки production vs development
- Проблемы и их решения

### 4. По завершении

```bash
git add .
git commit -m "feat(002): docker-композиция"
git checkout main
git merge feature/002-docker-setup
```
