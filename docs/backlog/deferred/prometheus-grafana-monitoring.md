# Мониторинг через Prometheus/Grafana

**Источник:** TD-025, TD-027
**Приоритет:** Низкий
**Тип:** Инфраструктура

## Идея

Добавить полноценный мониторинг метрик через Prometheus и визуализацию в Grafana.

## Метрики для сбора

### Telegram API
- Количество 429 ошибок (rate limit)
- Значения `retry_after`
- Время ответа API
- Количество отправленных/полученных сообщений

### Бизнес-метрики
- Количество открытых тикетов
- Среднее время ответа поддержки
- SLA нарушения
- Количество новых пользователей

### Системные метрики
- Redis connections
- PostgreSQL query time
- Memory/CPU usage
- Queue sizes (BullMQ)

### Silent Failures (из TD-027)
- GeoIP cache hits/misses
- GeoIP API errors count
- Redis connection errors
- Graceful degradation events (когда fallback сработал)

### Алерты
- `geoip_api_errors_total > 10/min` — проблемы с DaData API
- `redis_errors_total > 5/min` — проблемы с Redis
- `telegram_429_total > 3/min` — rate limiting Telegram API

## Реализация

1. Добавить `prom-client` для экспорта метрик
2. Создать endpoint `/metrics` для Prometheus
3. Настроить Prometheus для сбора метрик
4. Создать Grafana дашборды

## Когда делать

Имеет смысл при:
- Высокой нагрузке (>1000 тикетов/день)
- Необходимости SLA отчётности
- Команде поддержки >5 человек
- Требованиях к аптайму (SLA 99.9%)

## Альтернативы

- **Sentry** — уже используется для ошибок
- **Логи** — базовый мониторинг через pino
- **Telegram алерты** — можно отправлять в отдельный чат
