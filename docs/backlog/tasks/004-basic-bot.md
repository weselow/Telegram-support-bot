# Задача 004: Базовый бот

**Этап:** 1 - Фундамент
**Статус:** TODO
**Приоритет:** Высокий

## Описание

Создать минимального работающего бота с обработкой /start.

## Подзадачи

- [ ] Создание конфига для загрузки .env (src/config/env.ts)
- [ ] Инициализация grammY бота (src/bot/bot.ts)
- [ ] Обработчик команды /start:
  - [ ] Приветственное сообщение
  - [ ] Запрос описания проблемы
- [ ] Создание точки входа (src/index.ts)
- [ ] Настройка graceful shutdown
- [ ] Базовое логирование (pino)
- [ ] Проверка работы в Docker

## Зависимости

- [001-project-init](./001-project-init.md)
- [002-docker-setup](./002-docker-setup.md)

## Результат

- Бот запускается и отвечает на /start
- Логи выводятся в консоль
- Бот корректно останавливается при SIGTERM

---

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/004-basic-bot
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/004-basic-bot
```

### 3. Веди историю решений

В файле `docs/solutions/004-basic-bot/decisions.md` записывай:
- Структура обработчиков
- Выбор между long-polling и webhook
- Обработка ошибок

### 4. По завершении

```bash
git add .
git commit -m "feat(004): базовый бот"
git checkout main
git merge feature/004-basic-bot
```
