# TD-027: Типизация — TicketStatus union type

**Дата:** 2025-12-29
**Приоритет:** Средний
**Сложность:** Низкая (10 мин)

## Проблема

В нескольких местах `status` типизирован как `string` вместо строгого union type:

- `src/services/web-chat.service.ts:15` — `InitSessionResult.status: string`
- `src/services/web-chat.service.ts:34` — `ChatStatus.status: string`

Это позволяет передавать произвольные строки вместо валидных статусов.

## Риски без исправления

- Нет compile-time проверки корректности статусов
- Возможны опечатки в строковых значениях
- IDE не подсказывает допустимые значения

## Решение

1. Использовать существующий тип `TicketStatus` из Prisma:
```typescript
import type { TicketStatus } from '../generated/prisma/client.js';
```

2. Обновить интерфейсы:
```typescript
export interface InitSessionResult {
  sessionId: string;
  isNewSession: boolean;
  hasHistory: boolean;
  telegramLinked: boolean;
  status: TicketStatus;  // было: string
}

export interface ChatStatus {
  ticketId: string;
  status: TicketStatus;  // было: string
  // ...
}
```

## Файлы для изменения

- [ ] `src/services/web-chat.service.ts` — InitSessionResult, ChatStatus
