# TD-002: Дифференциация типов ошибок в catch блоке

**Severity:** MEDIUM
**Source:** Security Review (task 006)
**File:** `src/bot/handlers/message.ts:66-69`

## Проблема

Catch блок ловит все ошибки без различия между типами:
- Telegram API rate limiting (HTTP 429)
- Бот удалён из группы (403)
- Топик удалён
- Ошибки базы данных
- Сетевые таймауты

Пользователь получает одинаковое сообщение "попробуйте ещё раз" независимо от причины.

## Влияние

- Для временных ошибок (rate limit) — retry имеет смысл
- Для постоянных (бот удалён) — retry никогда не сработает
- Пользователь не понимает, стоит ли повторять попытку

## Рекомендация

```typescript
import { GrammyError } from 'grammy';

} catch (error) {
  if (error instanceof GrammyError) {
    if (error.error_code === 429) {
      await ctx.reply('Слишком много сообщений. Подождите немного.');
      return;
    }
    if (error.error_code === 403) {
      logger.error({ topicId: user.topicId }, 'Bot removed from support group');
      await ctx.reply('Технические проблемы. Обратитесь позже.');
      return;
    }
  }
  logger.error({ error, tgUserId: ctx.from.id }, 'Failed to mirror message');
  await ctx.reply('Не удалось доставить сообщение. Попробуйте ещё раз.');
}
```

## Приоритет

Средний — улучшает UX и диагностику.

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
