# TD-016: Отсутствие fallback при ошибке answerCallbackQuery

## Проблема

В `src/bot/handlers/callback.ts` если основная операция failed И answerCallbackQuery тоже failed, пользователь не получает никакой обратной связи.

## Текущее поведение

```typescript
await ctx.answerCallbackQuery({ text: 'Ошибка' }).catch((err) => {
  logger.error({ error: err }, 'Failed to answer error callback');
  // Пользователь не знает что произошло
});
```

## Последствия

- Пользователь остаётся без feedback
- UI показывает "loading" на кнопке

## Предлагаемое решение

Добавить fallback — отправить обычное сообщение:
```typescript
await ctx.answerCallbackQuery({ text: 'Ошибка' }).catch(async (err) => {
  logger.error({ error: err }, 'Failed to answer error callback');
  try {
    await ctx.reply('⚠️ Произошла ошибка при обновлении статуса');
  } catch {
    // Уже ничего не сделать
  }
});
```

## Приоритет

Низкий — редкий edge case (double failure).

## Источник

PR review для задачи 014.

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
