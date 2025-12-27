# Unit тесты для сервисов

**Дата:** 2025-12-27
**Источник:** TD-021

## Проблема

Сервисы ticket.service, message.service и sla.service не имели unit тестов из-за проблемы совместимости ESM + Prisma + Jest.

## Причина

Jest не поддерживает `import.meta.url`, который использует Prisma client. Блокер был указан в задаче 018.

## Решение

После миграции на Vitest (который нативно поддерживает ESM) блокер был устранён. Созданы unit тесты для всех трёх сервисов:

- `ticket.service.test.ts` — 8 тестов (findUserByTgId, findUserByTopicId, createTicket)
- `sla.service.test.ts` — 6 тестов (startSlaTimers, cancelAllSlaTimers)
- `message.service.test.ts` — 17 тестов (mirrorUserMessage, mirrorSupportMessage, editMirroredUserMessage, editMirroredSupportMessage)

Итого: 31 новый тест.

## Изменённые файлы

- `src/services/__tests__/ticket.service.test.ts` — создан
- `src/services/__tests__/sla.service.test.ts` — создан
- `src/services/__tests__/message.service.test.ts` — создан

## Важно для разработчика

- Паттерн мокирования для ESM: использовать `vi.mock()` с factory function
- Для доступа к мокам в тестах: dynamic import в `beforeEach`
- grammY Api мокируется как plain object с `vi.fn()` методами
