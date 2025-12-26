# Решения по задаче 012: BullMQ + Redis

## Структура очередей

### sla-queue
- Напоминания о SLA (10 мин, 30 мин, 2 часа)
- Задачи с задержкой (delayed jobs)
- При смене статуса — отмена предыдущих задач

### autoclose-queue
- Автозакрытие тикетов через 7 дней неактивности
- Одна задача на тикет
- При активности — перепланирование

## Настройки

### Повторные попытки
- attempts: 3
- backoff: exponential (1s, 2s, 4s)

### Обработка ошибок
- Логирование failed jobs
- Не блокировать основной поток

## Структура файлов

```
src/
  config/
    redis.ts          # Redis connection
  jobs/
    index.ts          # Export all
    queues.ts         # Queue definitions
    workers.ts        # Worker initialization
    sla.worker.ts     # SLA worker (placeholder)
    autoclose.worker.ts # Autoclose worker (placeholder)
```

## Graceful Shutdown

1. Остановить приём новых задач
2. Дождаться завершения текущих (timeout 10s)
3. Закрыть соединение с Redis
