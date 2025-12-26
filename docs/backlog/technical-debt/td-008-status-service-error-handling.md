# TD-008: Улучшение обработки ошибок в status.service.ts

## Проблема

Функция `autoChangeStatus` в `src/services/status.service.ts` возвращает `{ changed: false }` как при отсутствии необходимости менять статус, так и при ошибке БД. Это делает невозможным различение этих двух ситуаций для вызывающего кода.

## Текущее поведение

```typescript
} catch (error) {
  logger.error({ error, userId: user.id, trigger }, 'Failed to auto change status');
  return { changed: false, oldStatus, newStatus: oldStatus };  // Ошибка замаскирована
}
```

## Последствия

1. Вызывающий код не может отличить "смена не нужна" от "ошибка БД"
2. Ошибка обновления карточки скрыта — возвращается `changed: true`
3. Уведомление в топик после закрытия может не дойти, пользователь не узнает

## Предлагаемое решение

Изменить возвращаемый тип на:
```typescript
interface StatusChangeResult {
  success: boolean;
  changed: boolean;
  error?: string;
  cardUpdateFailed?: boolean;
}
```

## Приоритет

Низкий — ошибки логируются, функциональность работает. Улучшение для отладки и мониторинга.

## Источник

PR review для задачи 010.
