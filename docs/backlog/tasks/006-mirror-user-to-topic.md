# Задача 006: Зеркалирование сообщений (user → topic)

**Этап:** 2 - Основной функционал
**Статус:** TODO
**Приоритет:** Высокий

## Описание

Пересылать сообщения пользователя из DM в топик поддержки.

## Подзадачи

- [ ] Сервис зеркалирования (src/services/message.service.ts):
  - [ ] Копирование текстовых сообщений
  - [ ] Копирование медиа (фото, видео, документы, аудио, voice)
  - [ ] Копирование контактов и геолокации
  - [ ] Копирование стикеров и GIF
  - [ ] Сохранение связи message_id в messages_map
- [ ] Обработчик сообщений пользователя (src/bot/handlers/user.handler.ts):
  - [ ] Получение топика из БД
  - [ ] Вызов сервиса зеркалирования
  - [ ] Обработка ошибок
- [ ] Репозиторий сообщений (src/db/repositories/message.repository.ts)

## Зависимости

- [005-topic-creation](./005-topic-creation.md)

## Результат

- Все типы сообщений пересылаются в топик
- Связь dm_message_id ↔ topic_message_id сохраняется
- Медиа отображаются корректно

---

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/006-mirror-user-to-topic
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/006-mirror-user-to-topic
```

### 3. Веди историю решений

В файле `docs/solutions/006-mirror-user-to-topic/decisions.md` записывай:
- Способ копирования разных типов сообщений
- Обработка caption у медиа
- Лимиты Telegram API

### 4. По завершении

```bash
git add .
git commit -m "feat(006): зеркалирование user → topic"
git checkout main
git merge feature/006-mirror-user-to-topic
```
