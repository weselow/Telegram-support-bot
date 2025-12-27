# Логирование полного провала DM при SLA escalation

**Дата:** 2025-12-27
**Источник:** TD-010

## Проблема

При SLA breach (2 часа без ответа) если все DM админам не доходят — не было единого CRITICAL лога. Только отдельные warn для каждого админа.

## Решение

Добавлен error-уровень лог при `sent === 0 && admins.length > 0`:

```typescript
logger.error(
  { adminCount: admins.length },
  'CRITICAL: Failed to send DM to ANY admin during SLA escalation'
);
```

## Изменённые файлы

- `src/services/group.service.ts` — добавлен critical лог

## Важно для разработчика

- Этот лог должен вызывать alert в мониторинге
- Означает: никто из команды не узнал о критическом SLA breach
