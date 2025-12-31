# Widget Bot Avatar and Name

**Дата:** 2025-12-31
**Источник:** TD-040

## Проблема

В виджете чата использовались захардкоженные значения для имени бота ("Поддержка DellShop") и стандартная иконка вместо реального аватара бота из Telegram.

## Решение

Реализована загрузка информации о боте через Telegram Bot API с кэшированием на 1 час.

### Backend

1. Создан сервис `src/services/bot-info.service.ts`:
   - Получает информацию о боте через `bot.api.getMe()`
   - Получает аватар через `bot.api.getUserProfilePhotos()`
   - Кэширует результат на 1 час
   - Возвращает fallback при ошибках

2. Добавлен эндпоинт `GET /api/chat/bot-info` в `src/http/routes/chat.ts`:
   - Возвращает `{ name, username, avatarUrl }`
   - Поддерживает CORS

### Widget

1. Добавлен тип `BotInfoResponse` в `chat-widget/src/types/messages.ts`

2. Добавлен метод `getBotInfo()` в `chat-widget/src/transport/http.ts`

3. Обновлен `chat-widget/src/ui/header.ts`:
   - Добавлена поддержка `avatarUrl` в опциях
   - Добавлены методы `setTitle()`, `setAvatar()` для динамического обновления
   - При наличии `avatarUrl` отображается `<img>` вместо SVG иконки
   - Реализован fallback на иконку при ошибке загрузки изображения

4. Обновлен `chat-widget/src/widget.ts`:
   - Добавлено свойство `botInfo` для хранения информации о боте
   - Добавлен метод `fetchBotInfo()` для загрузки (non-blocking)
   - Bot info загружается при инициализации виджета
   - Header обновляется динамически после загрузки

5. Добавлены стили для аватара-изображения в `chat-widget/src/styles/base.css`

## Изменённые файлы

- `src/services/bot-info.service.ts` — новый сервис с кэшированием
- `src/http/routes/chat.ts` — эндпоинт /api/chat/bot-info
- `chat-widget/src/types/messages.ts` — тип BotInfoResponse
- `chat-widget/src/transport/http.ts` — метод getBotInfo()
- `chat-widget/src/ui/header.ts` — поддержка аватара и методы обновления
- `chat-widget/src/widget.ts` — загрузка и применение bot info
- `chat-widget/src/styles/base.css` — стили для avatar-img

## Важно для разработчика

- Аватар кэшируется на 1 час, перезапуск сервера сбросит кэш
- При отсутствии аватара у бота отображается стандартная иконка
- Загрузка bot info non-blocking — виджет открывается сразу, header обновится после загрузки
- URL аватара формируется через Telegram File API: `https://api.telegram.org/file/bot{token}/{file_path}`
