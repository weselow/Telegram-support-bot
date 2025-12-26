# TD-004: Валидация номера телефона в контактах

**Severity:** LOW
**Source:** Security Review (task 006)
**File:** `src/services/message.service.ts:76-81`

## Проблема

Контакты пересылаются без валидации формата номера телефона:

```typescript
return api.sendContact(groupId, msg.contact.phone_number, msg.contact.first_name, {
  message_thread_id: topicId,
});
```

## Влияние

Минимальное — Telegram сам валидирует данные. Но нестандартные форматы могут вызвать проблемы в downstream системах.

## Рекомендация

Добавить базовую валидацию или логирование нестандартных форматов:

```typescript
const phoneRegex = /^\+?[1-9]\d{6,14}$/;
if (!phoneRegex.test(msg.contact.phone_number)) {
  logger.warn({ phone: msg.contact.phone_number }, 'Unusual phone format');
}
```

## Приоритет

Низкий — nice to have.
