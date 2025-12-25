# Решения по задаче 006: Зеркалирование user → topic

## Способ копирования разных типов сообщений

Используются нативные методы grammY API для каждого типа:
- `text` → `api.sendMessage()`
- `photo` → `api.sendPhoto()` (берется последнее фото — наибольшее разрешение)
- `video` → `api.sendVideo()`
- `document` → `api.sendDocument()`
- `voice` → `api.sendVoice()`
- `audio` → `api.sendAudio()`
- `video_note` → `api.sendVideoNote()`
- `sticker` → `api.sendSticker()`
- `animation` (GIF) → `api.sendAnimation()`
- `contact` → `api.sendContact()`
- `location` → `api.sendLocation()`

## Обработка caption у медиа

Caption передается только для типов, которые его поддерживают:
- photo, video, document, audio, animation

Используется helper-функция `buildOptions()` для условного добавления caption в опции, чтобы избежать проблем с `exactOptionalPropertyTypes`.

## Структура файлов

```
src/
├── db/repositories/
│   └── message.repository.ts  # CRUD для MessageMap
├── services/
│   └── message.service.ts     # mirrorUserMessage()
└── bot/handlers/
    └── message.ts             # Интеграция зеркалирования
```

## Лимиты Telegram API

- Размер файлов: до 50MB для загрузки, до 20MB для отправки через file_id
- Telegram сам хранит файлы, мы только передаем file_id
- Ограничение на количество сообщений: ~30 сообщений/секунду на бота

## Обработка ошибок

- Ошибки зеркалирования логируются, но не прерывают работу бота
- Если тип сообщения не поддерживается, функция возвращает null (сообщение не сохраняется в messages_map)
