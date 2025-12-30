# TicketStatus Union Type

**Дата:** 2025-12-30
**Источник:** TD-027

## Проблема

В интерфейсах `InitSessionResult` и `ChatStatus` поле `status` было типизировано как `string`, хотя в Prisma-схеме используется enum `TicketStatus`. Это снижало type safety и не давало IDE подсказывать допустимые значения.

## Причина

При первоначальной реализации web-chat API использовался string для простоты, без привязки к Prisma-типам.

## Решение

Заменён тип `string` на `TicketStatus` из Prisma в файле `src/services/web-chat.service.ts`:

```typescript
import type { User, MessageMap, TicketStatus } from '../generated/prisma/client.js';

export interface InitSessionResult {
  // ...
  status: TicketStatus;  // было: string
}

export interface ChatStatus {
  // ...
  status: TicketStatus;  // было: string
}
```

## Изменённые файлы

- `src/services/web-chat.service.ts` — импорт TicketStatus, обновление типов интерфейсов

## Важно для разработчика

- `TicketStatus` — это Prisma enum с значениями: `NEW`, `IN_PROGRESS`, `WAITING_CLIENT`, `CLOSED`
- При добавлении новых интерфейсов с полем status использовать `TicketStatus`, не `string`
- Тип генерируется Prisma автоматически при `prisma generate`
