# TD-025: Мониторинг rate limit ошибок Telegram API

**Severity:** LOW
**Source:** Анализ TD-003

## Проблема

При превышении лимитов Telegram API возвращает HTTP 429 (Too Many Requests) + `retry_after`.

Вопрос: как мы узнаем, что это происходит?

## Идея

Нужен механизм оповещения/мониторинга:
- Логирование 429 ошибок с метриками (частота, retry_after)
- Алерт в Sentry при частых 429
- Возможно: дашборд или метрики в Prometheus/Grafana

## Связь с задачами

- TD-003 — rate limiting (предотвращение)
- TD-002 — обработка 429 (реакция)
- Данная задача — мониторинг (наблюдение)

## Приоритет

Низкий — реализовать после базового rate limiting.

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
