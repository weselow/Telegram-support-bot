# Decisions: Интеграция с сайтом — endpoint /ask-support

## Контекст

Требовалось реализовать интеграцию бота с сайтом: при клике на кнопку "Поддержка" пользователь переходит в Telegram-бота, а бот получает информацию о том, откуда пришёл пользователь (URL, IP, город).

## Принятые решения

### HTTP сервер
- **Fastify** вместо Express — легковеснее, встроенная типизация, лучшая производительность
- `trustProxy: true` — для корректного получения IP через reverse proxy (Caddy/nginx)

### Защита от ботов
- Проверка User-Agent с blocklist поисковых ботов и CLI-инструментов
- Rate limit 10 req/min по IP (Redis, fail-open при недоступности)

### GeoIP
- DaData API (`/suggestions/api/4_1/rs/iplocate/address`)
- Кеширование в Redis на 7 дней
- Graceful degradation — если DaData недоступен, продолжаем без города

### Передача контекста
- Short ID (8 hex символов) в deep link: `t.me/BOT?start=abc12345`
- Данные в Redis с TTL 1 час
- Атомарное GETDEL при получении (one-time use)
- Дополнительный контекст пользователя с TTL 24 часа (между /start и первым сообщением)

### Валидация payload
- Regex `/^[0-9a-f]{8}$/i` для защиты от некорректных данных

## Что реализовано

- [x] HTTP сервер (Fastify) с endpoints /ask-support и /health
- [x] Фильтр ботов по User-Agent
- [x] Rate limit по IP (10 req/min)
- [x] GeoIP через DaData с кешированием
- [x] Обработка payload в /start handler
- [x] Карточка тикета с IP и городом
- [x] Миграция Prisma для source_city
- [x] Тесты для bot-filter, rate-limit, start handler
- [x] Документация docs/deployment/website-integration.md

## Что НЕ реализовано

- [ ] Docker + Caddy конфигурация → отдельная задача инфраструктуры
- [ ] Мониторинг rate limit → TD-027
- [ ] Расширенное логирование GeoIP → TD-028
- [ ] Branded types для IP/URL → TD-029

## Технические детали

### Схема Redis

```
redirect:{shortId}      → RedirectData (TTL 1h)
user_context:{tgUserId} → UserRedirectContext (TTL 24h)
geoip:{ip}              → GeoIpResult (TTL 7d)
rate:ip:{ip}            → counter (TTL 60s)
```

### Формат карточки тикета

```
📋 Тикет

👤 Пользователь: Иван
👤 Username: @ivanpetrov
📱 Телефон: +79991234567
🔗 Источник: https://shop.com/product/123
🌐 IP: 95.67.12.34 (Саратов)
📅 Создан: 27.12.2025, 12:30:45

Статус: 🆕 Новый
```

### Изменённые/созданные файлы

- `src/http/server.ts` — Fastify HTTP сервер
- `src/http/routes/ask-support.ts` — endpoint /ask-support
- `src/http/routes/health.ts` — endpoint /health
- `src/http/middleware/bot-filter.ts` — фильтр ботов
- `src/services/geoip.service.ts` — GeoIP через DaData
- `src/services/redirect-context.service.ts` — контекст между /start и сообщением
- `src/services/rate-limit.service.ts` — добавлен checkIpRateLimit
- `src/bot/handlers/start.ts` — обработка payload
- `src/bot/handlers/message.ts` — передача контекста в тикет
- `src/services/topic.service.ts` — IP+город в карточке
- `src/config/env.ts` — BOT_USERNAME, DADATA_API_KEY, HTTP_PORT
- `prisma/schema.prisma` — поле source_city
