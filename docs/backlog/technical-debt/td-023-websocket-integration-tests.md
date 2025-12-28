# TD-023: Integration-тесты для WebSocket API

**Статус:** TODO
**Приоритет:** Средний
**Источник:** Задача 021-web-chat-api

## Описание

Добавить integration-тесты для WebSocket API (`/ws/chat`).

## Что нужно покрыть

- [ ] Подключение с валидной сессией
- [ ] Отклонение подключения без сессии
- [ ] Отправка сообщения через WebSocket
- [ ] Получение сообщения от поддержки
- [ ] Typing indicator (client → server)
- [ ] Close ticket через WebSocket
- [ ] Ping/pong keep-alive
- [ ] Rate limiting WebSocket сообщений
- [ ] Reconnect и получение пропущенных сообщений

## Технические требования

- Использовать `ws` или `vitest` WebSocket client
- Мокировать Telegram Bot API
- Тестировать реальное подключение к Fastify server

## Критерии готовности

- [ ] Все WebSocket events покрыты тестами
- [ ] E2E сценарий: Web → Topic → Web работает
- [ ] Тесты стабильны (не flaky)
