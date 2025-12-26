# Задача 016: Sentry интеграция

**Этап:** 5 - Полировка
**Статус:** TODO
**Приоритет:** Низкий

## Описание

Подключить Sentry для логирования ошибок и событий.

## Подзадачи

- [ ] Установка @sentry/node
- [ ] Инициализация Sentry (src/utils/logger.ts):
  - [ ] DSN из .env
  - [ ] Environment (dev/prod)
  - [ ] Release version
- [ ] Логирование ошибок:
  - [ ] Ошибки Telegram API
  - [ ] Ошибки БД
  - [ ] Необработанные исключения
- [ ] Логирование событий (breadcrumbs):
  - [ ] Входящие сообщения
  - [ ] Исходящие сообщения
  - [ ] Смены статусов
  - [ ] SLA-события
- [ ] Контекст пользователя в ошибках

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
