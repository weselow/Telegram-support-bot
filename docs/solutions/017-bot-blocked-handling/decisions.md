# Decisions: Bot Blocked Handling

## Определение ошибки блокировки

**Telegram API возвращает:**
- HTTP статус: 403 Forbidden
- Описание: "Forbidden: bot was blocked by the user"

**Реализация:**
Используем GrammyError из grammy для проверки:
```typescript
import { GrammyError } from 'grammy';

function isBotBlockedError(error: unknown): boolean {
  return error instanceof GrammyError &&
         error.error_code === 403 &&
         error.description.includes('blocked by the user');
}
```

## Место обработки

**Решение:** Обрабатываем в `support.ts` handler

**Альтернативы:**
1. В message.service.ts — слишком низкоуровневый, не знает о топике
2. В support.ts — знает контекст, может отправить уведомление в топик

## Формат уведомления

```
⚠️ Пользователь заблокировал бота, сообщение не доставлено
```

- Использует `//` префикс — не зеркалируется обратно
- Предупреждающий emoji для заметности
- Информативный текст

## Статус тикета

**Решение:** Не менять статус автоматически

**Обоснование:**
- Сотрудник должен сам решить что делать
- Может попробовать связаться другим способом
- Может закрыть тикет вручную

## Разблокировка

При разблокировке пользователь может написать новое сообщение — тикет переоткроется автоматически (уже реализовано в task 010).

## Code Review Fixes

1. **Защитная проверка description** - добавлена проверка `typeof error.description === 'string'`
2. **Обработка ошибок уведомления** - ctx.reply в catch блоке обернут в try-catch для предотвращения silent failures

## Scope Decisions

**Не включено в задачу (out of scope):**
- Обработка "user is deactivated" (другой сценарий, можно добавить позже)
- Обработка "bot can't initiate conversation" (другой сценарий)
- Unit тесты (support.ts исключен из coverage по дизайну проекта)
