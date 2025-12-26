# Задача 007: Зеркалирование сообщений (topic → user)

**Этап:** 2 - Основной функционал
**Статус:** DONE
**Приоритет:** Высокий

## Описание

Пересылать сообщения сотрудников из топика в DM пользователя.

## Подзадачи

- [x] Обработчик сообщений в группе (src/bot/handlers/support.ts):
  - [x] Фильтрация: только сообщения из топиков (не General)
  - [x] Фильтрация: только от участников (не от бота)
  - [x] Определение пользователя по topic_id
  - [x] Вызов сервиса зеркалирования
- [x] Расширение message.service.ts:
  - [x] Метод для отправки в DM (dmSenders + mirrorSupportMessage)
  - [x] Сохранение связи в messages_map (direction: SUPPORT_TO_USER)
- [x] Фильтрация в bot.ts через .filter() вместо отдельного middleware

## Зависимости

- [006-mirror-user-to-topic](./006-mirror-user-to-topic.md)

## Результат

- Сообщения сотрудников доставляются пользователю
- Системные сообщения бота не пересылаются
- Связь сообщений сохраняется

---

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/007-mirror-topic-to-user
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/007-mirror-topic-to-user
```

### 3. Веди историю решений

В файле `docs/solutions/007-mirror-topic-to-user/decisions.md` записывай:
- Фильтрация сообщений бота
- Определение "системных" сообщений
- Обработка ошибок доставки

### 4. По завершении

```bash
git add .
git commit -m "feat(007): зеркалирование topic → user"
git checkout main
git merge feature/007-mirror-topic-to-user
```
