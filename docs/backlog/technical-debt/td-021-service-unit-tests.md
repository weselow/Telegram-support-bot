# TD-021: Unit тесты для сервисов

**Источник:** Задача 018
**Приоритет:** Средний
**Блокер:** ESM + Prisma + Jest несовместимость

## Описание

Не реализованы unit тесты для сервисов:
- ticket.service.ts
- message.service.ts
- sla.service.ts

## Причина

При попытке мокать модули с `jest.unstable_mockModule` возникает ошибка:
```
SyntaxError: Cannot use 'import.meta' outside a module
```

Prisma client использует `import.meta.url`, который не поддерживается Jest.

## Варианты решения

1. **Переход на Vitest** - нативная поддержка ESM
2. **Dependency Injection** - рефакторинг сервисов для передачи зависимостей
3. **Отдельные pure-function модули** - вынести логику из сервисов

## Связанные файлы

- src/services/ticket.service.ts
- src/services/message.service.ts
- src/services/sla.service.ts
- docs/solutions/018-tests/decisions.md
