# Задача 002: Docker-композиция

**Этап:** 1 - Фундамент
**Статус:** TODO
**Приоритет:** Высокий

## Описание

Настроить Docker-окружение для разработки и продакшена.

## Подзадачи

- [ ] Создание Dockerfile для Node.js приложения
- [ ] Создание docker-compose.yml с сервисами:
  - [ ] app (Node.js бот)
  - [ ] postgres (PostgreSQL 16)
  - [ ] redis (Redis 7)
- [ ] Настройка volumes для персистентности данных
- [ ] Настройка networks
- [ ] Создание docker-compose.override.yml для dev-режима
- [ ] Проверка запуска всех сервисов

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
