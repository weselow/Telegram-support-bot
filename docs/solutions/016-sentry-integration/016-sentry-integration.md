# Задача 016: Sentry интеграция

**Этап:** 5 - Полировка
**Статус:** DONE
**Приоритет:** Низкий

## Описание

Подключить Sentry для логирования ошибок и событий.

## Подзадачи

- [x] Установка @sentry/node
- [x] Инициализация Sentry (src/config/sentry.ts):
  - [x] DSN из .env
  - [x] Environment (dev/prod)
  - [x] Release version
- [x] Логирование ошибок:
  - [x] Ошибки Telegram API
  - [x] Ошибки БД
  - [x] Необработанные исключения
- [x] Логирование событий (breadcrumbs):
  - [x] Входящие сообщения
  - [x] Исходящие сообщения (support reply)
  - [x] SLA-события
  - [x] Autoclose-события
- [x] Контекст пользователя в ошибках

## Зависимости

- [004-basic-bot](./004-basic-bot.md)

## Результат

- Ошибки отправляются в Sentry
- Есть контекст для отладки
- События логируются как breadcrumbs

---

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/016-sentry-integration
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/016-sentry-integration
```

### 3. Веди историю решений

В файле `docs/solutions/016-sentry-integration/decisions.md` записывай:
- Какие события логировать
- Уровни логирования
- PII и приватность данных

### 4. Перед завершением — код-ревью

Запусти команду `/check-code` для проверки кода перед мержем.

### 5. По завершении

```bash
git add .
git commit -m "feat(016): Sentry интеграция"
git checkout main
git merge feature/016-sentry-integration
```
