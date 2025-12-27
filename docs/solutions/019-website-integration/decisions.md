# Decisions: 019 Website Integration

## Контекст

Нужно позволить пользователям переходить в бота с сайта, сохраняя контекст (URL, IP, город).

## Принятые решения

### HTTP фреймворк: Fastify
- Быстрее Express
- Лучше TypeScript поддержка
- Меньше размер

### Архитектура
- Endpoint `/ask-support` в боте
- Referer → URL страницы
- IP из X-Forwarded-For
- GeoIP через DaData (бесплатный endpoint)

### База данных
- Добавляем только `sourceCity` в User
- URL не сохраняем в БД (только передаём в Redis для карточки)

### DaData
- Endpoint: `https://suggestions.dadata.ru/suggestions/api/4_1/rs/iplocate/address`
- Кеш в Redis: 7 дней
- Сохраняем полный JSON ответа для пересылки на внешний endpoint

### Защита
- User-Agent фильтр (блокируем ботов)
- Rate limit: 10 req/min по IP

## Что реализовано

- [x] Переменные окружения (BOT_USERNAME, HTTP_PORT, SUPPORT_DOMAIN, DADATA_API_KEY)
- [x] Prisma schema (sourceCity)
- [x] HTTP сервер (Fastify) - src/http/server.ts
- [x] Фильтр ботов - src/http/middleware/bot-filter.ts
- [x] GeoIP сервис - src/services/geoip.service.ts
- [x] Endpoint /ask-support - src/http/routes/ask-support.ts
- [x] Endpoint /health - src/http/routes/health.ts
- [x] Интеграция в index.ts
- [x] startHandler с SHORT_ID - src/bot/handlers/start.ts
- [x] Карточка тикета с IP/городом - src/services/topic.service.ts
- [x] Тесты - src/http/middleware/__tests__/bot-filter.test.ts
- [x] Docker/Caddy - docker-compose.yml, Caddyfile.example
- [x] Документация - .env.example, decisions.md

## Технические детали

### Redis ключи
```
redirect:{shortId} → { url, ip, city, dadataResponse }  TTL 1h
geoip:{ip} → { city, response }                         TTL 7d
```

### Порты
- 3000 — HTTP сервер (Fastify)
- Caddy проксирует HTTPS → 3000
