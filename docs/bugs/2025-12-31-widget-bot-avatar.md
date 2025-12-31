# Widget Bot Avatar and Name

**Дата:** 2025-12-31
**Источник:** TD-040, TD-047

## Проблема

1. В виджете чата использовались захардкоженные значения для имени бота ("Поддержка DellShop") и стандартная иконка вместо реального аватара бота из Telegram.

2. **Безопасность (TD-047)**: URL аватара бота содержал токен бота (`https://api.telegram.org/file/bot{TOKEN}/{file_path}`), который мог утечь на клиент.

3. **UX**: Когда у бота не было аватара, виджет получал `null` и отображал пустое место.

## Решение

### TD-040: Загрузка информации о боте

Реализована загрузка информации о боте через Telegram Bot API с кэшированием на 1 час.

#### Backend

1. Создан сервис `src/services/bot-info.service.ts`:
   - Получает информацию о боте через `bot.api.getMe()`
   - Кэширует результат на 1 час
   - Возвращает fallback при ошибках

2. Добавлен эндпоинт `GET /api/chat/bot-info` в `src/http/routes/chat.ts`:
   - Возвращает `{ name, username, avatarUrl }`
   - Поддерживает CORS

#### Widget

1. Добавлен тип `BotInfoResponse` в `chat-widget/src/types/messages.ts`
2. Добавлен метод `getBotInfo()` в `chat-widget/src/transport/http.ts`
3. Обновлен `chat-widget/src/ui/header.ts` — поддержка аватара и методы обновления
4. Обновлен `chat-widget/src/widget.ts` — загрузка и применение bot info
5. Добавлены стили для аватара-изображения в `chat-widget/src/styles/base.css`

### TD-047: Прокси-эндпоинт для аватара

Реализован прокси-эндпоинт для аватара бота с lazy loading и кэшированием:

1. **`getBotInfo()`** всегда возвращает `avatarUrl: '/api/chat/bot-avatar'` (никогда не `null`)
2. **`GET /api/chat/bot-avatar`** — новый эндпоинт, возвращающий бинарные данные аватара
3. **`getBotAvatar()`** — функция для lazy loading аватара с TTL-кэшированием (1 час)
4. **SVG-плейсхолдер** — отдаётся когда у бота нет аватара или при ошибках

#### Особенности

- Аватар скачивается при первом обращении, не при старте сервера
- Кэширование в памяти с TTL 1 час
- Всегда возвращается изображение (никогда не null/404)
- Плейсхолдер — нейтральный силуэт человека (серый круг)
- Токен бота не передаётся на клиент

## Изменённые файлы

**Backend:**
- `src/services/bot-info.service.ts` — сервис с кэшированием, `getBotAvatar()`, SVG-плейсхолдер
- `src/http/routes/chat.ts` — эндпоинты `/api/chat/bot-info` и `/api/chat/bot-avatar`
- `src/services/__tests__/bot-info.service.test.ts` — 14 тестов
- `src/http/routes/__tests__/chat-cors.test.ts` — обновлены моки

**Widget:**
- `chat-widget/src/types/messages.ts` — тип BotInfoResponse
- `chat-widget/src/transport/http.ts` — метод getBotInfo()
- `chat-widget/src/ui/header.ts` — поддержка аватара и методы обновления
- `chat-widget/src/widget.ts` — загрузка и применение bot info
- `chat-widget/src/styles/base.css` — стили для avatar-img

## Важно для разработчика

- `avatarUrl` в `BotInfo` теперь всегда строка `/api/chat/bot-avatar`, никогда не `null`
- `getBotAvatar()` всегда возвращает `BotAvatar` с данными (реальный аватар или плейсхолдер)
- Эндпоинт `/api/chat/bot-avatar` отдаёт правильный `Content-Type` (`image/jpeg`, `image/png` или `image/svg+xml`)
- Браузерное кэширование через `Cache-Control: public, max-age=3600`
- Загрузка bot info non-blocking — виджет открывается сразу, header обновится после загрузки
