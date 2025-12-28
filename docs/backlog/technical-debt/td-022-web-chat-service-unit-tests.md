# TD-022: Unit-тесты для WebChatService

**Статус:** TODO
**Приоритет:** Средний
**Источник:** Задача 021-web-chat-api

## Описание

Добавить unit-тесты для `src/services/web-chat.service.ts`.

## Что нужно покрыть

- [ ] `initSession` — создание новой сессии, возврат существующей
- [ ] `getHistory` — пагинация, before/after параметры
- [ ] `getStatus` — возврат корректного статуса
- [ ] `sendMessage` — создание топика, отправка с [WEB] префиксом, replyTo
- [ ] `linkTelegram` — генерация токена, формат URL
- [ ] `closeTicket` — смена статуса, уведомление в топик
- [ ] `processLinkToken` — валидация токена, привязка аккаунта

## Зависимости

- Мокирование `bot.api`
- Мокирование `userRepository`, `messageRepository`, `webLinkTokenRepository`

## Критерии готовности

- [ ] Покрытие web-chat.service.ts ≥80%
- [ ] Все edge cases покрыты
- [ ] Тесты проходят в CI
