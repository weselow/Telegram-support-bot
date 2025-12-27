# Выделение Pure Functions

**Источник:** TD-024
**Приоритет:** Низкий
**Тип:** Рефакторинг

## Идея

Выделить чистые функции (pure functions) из сервисов в отдельные модули без зависимостей. Это упростит тестирование — не нужны моки для БД/Redis.

## Что такое Pure Function

Функция, которая:
1. При одинаковых входных данных **всегда** возвращает одинаковый результат
2. **Не имеет побочных эффектов** (не обращается к БД, API, файлам)

## Пример

```typescript
// ✅ Pure function — легко тестировать
function calculateSlaDeadline(createdAt: Date, minutesLimit: number): Date {
  return new Date(createdAt.getTime() + minutesLimit * 60 * 1000);
}

// ❌ Impure function — зависит от внешнего состояния
async function getSlaDeadline(ticketId: string): Promise<Date> {
  const ticket = await db.tickets.findById(ticketId);
  return new Date(ticket.createdAt.getTime() + SLA_LIMIT * 60 * 1000);
}
```

## Кандидаты на выделение

| Модуль | Функциональность |
|--------|------------------|
| `src/utils/sla-calculator.ts` | Расчёт SLA дедлайнов и таймингов |
| `src/utils/status-transitions.ts` | Валидация переходов статусов тикета |
| `src/utils/message-filters.ts` | Проверка internal сообщений (`//`, `#internal`) |
| `src/utils/payload-validator.ts` | Валидация и парсинг payload из /start |

## Преимущества

- Тесты в 3 строки вместо 20+ с моками
- Мгновенный запуск без setup
- Детерминированный результат
- Легче понять и поддерживать

## Когда делать

Можно выполнять **постепенно** при рефакторинге соответствующих сервисов. Не требует единовременной миграции.

## Связанные файлы

- `src/services/sla.service.ts`
- `src/services/ticket.service.ts`
- `src/services/message.service.ts`
- `src/bot/handlers/start.ts`
