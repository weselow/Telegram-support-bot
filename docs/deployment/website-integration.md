# Интеграция с сайтом

## Обзор

Пользователь кликает кнопку "Поддержка" на сайте → переходит через redirect сервис → открывается Telegram с ботом → бот знает откуда пришёл пользователь и его геолокацию.

## Архитектура

```
┌─────────────┐     ┌──────────────────────────────┐     ┌──────────────┐
│    Сайт     │ ──► │  /ask-support endpoint       │ ──► │   Telegram   │
│   (клик)    │     │  (Fastify HTTP сервер)       │     │              │
└─────────────┘     │                              │     └──────┬───────┘
                    │  1. Rate limit по IP         │            │
                    │  2. Проверка User-Agent      │            │
                    │  3. Получение IP + Referer   │            │
                    │  4. GeoIP → город (DaData)   │            │
                    │  5. Сохранение в Redis       │            │
                    │  6. Redirect в Telegram      │            │
                    └──────────────────────────────┘            │
                                                                ▼
                                                   ┌────────────────────────┐
                                                   │  Бот                   │
                                                   │  - Получает SHORT_ID   │
                                                   │  - Достаёт из Redis    │
                                                   │  - Создаёт тикет       │
                                                   └────────────────────────┘
```

---

## Интеграция на сайте

### Одна ссылка для всех сайтов

```html
<a href="https://support.yoursite.com/ask-support" class="support-button">
  💬 Нужна помощь?
</a>
```

Referer передаётся автоматически браузером.

### Важно

- Ссылка должна быть обычной `<a>`, не через JavaScript
- Не добавлять `rel="noreferrer"` — иначе Referer не передастся
- HTTPS → HTTPS работает корректно

---

## Что собирается

| Данные | Источник | Показывается |
|--------|----------|--------------|
| URL страницы | Referer header | Агентам в тикете |
| IP адрес | X-Forwarded-For / request.ip | Агентам в тикете |
| Город | DaData API по IP | Агентам в тикете |

**Пользователю IP не показывается.**

---

## Карточка тикета (для агентов)

```
📋 Тикет

👤 Пользователь: Иван
👤 Username: @ivanpetrov
📱 Телефон: +79991234567
🔗 Источник: https://shop.com/product/iphone-15
🌐 IP: 95.67.12.34 (Саратов)
📅 Создан: 27.12.2025, 12:30:45

Статус: 🆕 Новый
```

---

## Защита от ботов

Endpoint `/ask-support` проверяет User-Agent и блокирует:

- Пустой User-Agent
- Поисковые боты: `googlebot`, `bingbot`, `yandex`, `baidu`, `duckduckbot`, `sogou`, `exabot`
- Краулеры: `spider`, `crawler`, `scraper`, `bot/`
- CLI: `curl`, `wget`, `python`, `httpie`, `axios`, `node-fetch`, `go-http-client`
- Headless браузеры: `headlesschrome`, `phantomjs`, `puppeteer`, `playwright`, `selenium`

При блокировке возвращается 403 Forbidden.

### Rate Limit

10 запросов в минуту с одного IP. При превышении:
- Статус: 429 Too Many Requests
- Header: `Retry-After: N` (секунд до сброса)

---

## Переменные окружения

```env
# HTTP сервер
HTTP_PORT=3000

# Username бота (без @)
BOT_USERNAME=your_support_bot

# DaData API ключ для GeoIP
DADATA_API_KEY=your-api-key
```

---

## Инфраструктура

Боевая среда развёрнута в Coolify: приложение, PostgreSQL и Redis — отдельные ресурсы, HTTPS и домен обслуживает встроенный прокси. Настройка ресурсов, переменные окружения и порядок выкатки описаны в [README.md](README.md).

Локально приложение поднимается через `docker-compose.yml` в корне репозитория, HTTP-сервер доступен на `127.0.0.1:3000`.

### Важно: Trust Proxy

HTTP сервер настроен с `trustProxy: true`, поэтому корректно получает реальный IP клиента из заголовка `X-Forwarded-For`, который добавляет обратный прокси.

---

## Схема данных в Redis

```
# Redirect данные (TTL 1 час)
redirect:{shortId} → {
  ip: "95.67.12.34",
  sourceUrl: "https://shop.com/product/123",
  city: "Саратов",
  geoipResponse: { ... },  // Полный ответ DaData
  createdAt: "2025-12-27T12:30:45.000Z"
}

# Контекст пользователя (TTL 24 часа)
user_context:{tgUserId} → {
  sourceUrl: "https://shop.com/product/123",
  sourceCity: "Саратов",
  ip: "95.67.12.34",
  geoipResponse: { ... }
}

# GeoIP кеш (TTL 7 дней)
geoip:{ip} → {
  city: "Саратов",
  fullResponse: { ... }
}

# Rate limit (TTL 60 секунд)
rate:ip:{ip} → count
```

---

## Флоу пользователя

```
1. Клик по кнопке на сайте
   ↓
2. GET /ask-support
   ↓
3. Проверка rate limit (10 req/min по IP)
   ↓
4. Проверка User-Agent (блок ботов)
   ↓
5. Получение IP и Referer
   ↓
6. Запрос GeoIP (DaData, с кешем)
   ↓
7. Генерация short ID (8 символов hex)
   ↓
8. Сохранение в Redis (TTL 1 час)
   ↓
9. Redirect 302 → t.me/BOT?start=SHORT_ID
   ↓
10. Telegram открывает бота
    ↓
11. /start с payload → бот достаёт данные из Redis
    ↓
12. Сохранение контекста для пользователя (TTL 24 часа)
    ↓
13. Первое сообщение → создание тикета с данными
```

---

## API Endpoints

### GET /ask-support

Основной endpoint интеграции.

**Успешный ответ:**
- Status: 302 Found
- Location: `https://t.me/BOT_USERNAME?start=SHORT_ID`

**Ошибки:**
- 403 Forbidden — заблокированный User-Agent (бот)
- 429 Too Many Requests — превышен rate limit

### GET /health

Health check для мониторинга.

**Ответ:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-29T09:12:34.567Z",
  "commit": "9f1c2b3d4e5f60718293a4b5c6d7e8f901234567"
}
```

`commit` — хеш коммита, из которого собран образ. Приезжает build-аргументом `APP_COMMIT` при сборке; при запуске из исходников равен `dev`. По нему шаг ожидания в `.github/workflows/deploy.yml` понимает, что поднялась именно новая версия.

---

## Файлы реализации

| Файл | Описание |
|------|----------|
| `src/http/server.ts` | Fastify HTTP сервер |
| `src/http/routes/ask-support.ts` | Endpoint /ask-support |
| `src/http/routes/health.ts` | Endpoint /health |
| `src/http/middleware/bot-filter.ts` | Фильтр ботов по User-Agent |
| `src/services/geoip.service.ts` | GeoIP через DaData с кешированием |
| `src/services/redirect-context.service.ts` | Хранение контекста между /start и первым сообщением |
| `src/services/rate-limit.service.ts` | Rate limiting по IP |
| `src/bot/handlers/start.ts` | Обработка payload из deep link |
| `src/bot/handlers/message.ts` | Создание тикета с данными из контекста |
| `src/services/topic.service.ts` | Формирование карточки тикета |
