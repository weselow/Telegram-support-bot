# Решения по задаче 001: Инициализация проекта

## Дата начала: 2025-12-26

---

## 1. Выбор версий

### Node.js
- **Выбор:** 22.x LTS
- **Причина:** Более стабильная, чем 24.x. Поддержка до апреля 2027.

### TypeScript
- **Выбор:** 5.x (latest)
- **Причина:** Актуальная версия с улучшенной поддержкой ESM

### Package Manager
- **Выбор:** npm
- **Альтернативы:** pnpm (быстрее), yarn
- **Причина:** Стандартный, меньше проблем с совместимостью в Docker

---

## 2. Структура проекта

```
src/
├── bot/           # grammY бот и обработчики
├── services/      # Бизнес-логика
├── db/            # Prisma и репозитории
├── jobs/          # BullMQ воркеры
├── config/        # Конфигурация
└── utils/         # Утилиты
```

---

## 3. Зависимости

### Production
- grammy — Telegram Bot SDK
- @prisma/client — ORM
- bullmq — Job queue
- ioredis — Redis client (для BullMQ)
- pino — Логирование
- dotenv — Переменные окружения
- zod — Валидация конфига

### Development
- typescript
- @types/node
- tsx — Запуск TS без компиляции (dev)
- eslint + @typescript-eslint
- prettier

---

## 4. Проблемы и решения

(будет заполняться по мере работы)
