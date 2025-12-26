# Rate limiting для зеркалирования сообщений

**Дата:** 2025-12-27
**Источник:** TD-003

## Проблема

Отсутствие ограничения на количество сообщений от одного пользователя. Злоумышленник мог:
- Заспамить группу поддержки
- Исчерпать лимиты Telegram API (30 msg/sec)
- Раздуть базу данных (message map)

## Причина

Изначально rate limiting не был реализован.

## Решение

Добавлен rate limiting на базе Redis:
- Лимит: 10 сообщений в 60 секунд на пользователя
- Используется ключ `rate:user:{userId}` с TTL
- Fail open: при недоступности Redis — пропускаем (не блокируем пользователя)

## Изменённые файлы

- `src/config/redis-client.ts` — новый файл, singleton Redis клиент
- `src/services/rate-limit.service.ts` — новый файл, сервис rate limiting
- `src/bot/handlers/message.ts` — интеграция проверки rate limit
- `src/services/__tests__/rate-limit.service.test.ts` — тесты

## Важно для разработчика

- Константы `RATE_LIMIT=10` и `RATE_WINDOW=60` в rate-limit.service.ts
- При превышении лимита пользователь получает `messages.rateLimitError`
- Redis клиент — singleton, переиспользуется
- Fail open стратегия: если Redis недоступен, запрос пропускается (не блокируем реальных пользователей)
