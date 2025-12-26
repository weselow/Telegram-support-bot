# TD-010: Логирование полного провала DM при SLA escalation

## Проблема

Функция `sendDmToAdmins` в `src/services/group.service.ts` логирует каждого отдельного админа, которому не удалось отправить DM. Однако нет отдельного лога для случая когда `sent === 0` (ни один админ не получил сообщение).

## Текущее поведение

```typescript
if (sent === admins.length) {
  logger.info({ sent }, 'Admin DMs sent successfully');
}
// Если sent === 0, есть только отдельные warn для каждого админа
```

## Последствия

При критическом SLA breach (2 часа) все DM могут не дойти (все админы заблокировали бота). Это видно только если просматривать отдельные warn логи, нет единого error уровня для мониторинга.

## Предлагаемое решение

```typescript
if (sent === 0 && admins.length > 0) {
  logger.error({ adminCount: admins.length },
    'CRITICAL: Failed to send DM to ANY admin during SLA escalation');
}
```

## Приоритет

Низкий — каждый провал уже логируется. Улучшение для alerting/мониторинга.

## Источник

PR review для задачи 013.
