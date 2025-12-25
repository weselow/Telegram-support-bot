# Решения по Task 002: Docker-композиция

## Выбор базовых образов

### Node.js
- **Выбор:** `node:22-alpine`
- **Причина:** Alpine минимальный размер, Node 22 LTS соответствует требованиям проекта

### PostgreSQL
- **Выбор:** `postgres:16-alpine`
- **Причина:** PostgreSQL 16 — актуальная версия, Alpine для минимального размера

### Redis
- **Выбор:** `redis:7-alpine`
- **Причина:** Redis 7 — актуальная версия с поддержкой streams для BullMQ

## Структура

```
├── Dockerfile           # Multi-stage build для production
├── docker-compose.yml   # Base конфигурация
└── docker-compose.override.yml  # Dev overrides (hot reload)
```

## Production vs Development

| Аспект | Production | Development |
|--------|------------|-------------|
| Build | Multi-stage, минимальный образ | Монтирование src/ |
| Hot reload | Нет | tsx watch |
| Volumes | Только данные БД | + исходный код |
| Logs | JSON format | pino-pretty |

## Сети

- `support-bot-network` — внутренняя сеть для связи сервисов

## Volumes

- `postgres-data` — персистентность PostgreSQL
- `redis-data` — персистентность Redis (опционально)
