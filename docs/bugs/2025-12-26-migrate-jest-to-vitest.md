# Миграция с Jest на Vitest

**Дата:** 2025-12-26
**Источник:** TD-025

## Проблема

Jest не работает с ESM модулями и Prisma из-за ошибки:
```
SyntaxError: Cannot use 'import.meta' outside a module
```

Prisma Client использует `import.meta.url` для резолва путей, что несовместимо с трансформацией Jest через ts-jest.

## Причина

- Проект использует ESM (`"type": "module"` в package.json)
- Prisma Client использует `import.meta.url`
- Jest (даже с ts-jest) не полностью поддерживает ESM
- Экспериментальный `--experimental-vm-modules` нестабилен

## Решение

Миграция на Vitest — нативная поддержка ESM и TypeScript.

## Изменённые файлы

- `package.json` — заменены скрипты test/test:coverage на vitest
- `vitest.config.ts` — создан (конфиг перенесён из jest.config.js)
- `jest.config.js` — удалён
- `src/bot/handlers/__tests__/start.test.ts` — импорты с jest на vitest
- `src/config/__tests__/messages.test.ts` — импорты с jest на vitest

## Изменения в API

| Jest | Vitest |
|------|--------|
| `jest.fn()` | `vi.fn()` |
| `jest.Mock` | `Mock` (из vitest) |
| `jest.Mocked<T>` | `Mock` |
| `jest.clearAllMocks()` | `vi.clearAllMocks()` |

## Важно для разработчика

1. **Импорты в тестах:**
   ```typescript
   import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
   ```

2. **Запуск тестов:**
   - `npm test` — однократный запуск
   - `npm run test:watch` — watch mode
   - `npm run test:coverage` — с покрытием

3. **Конфигурация** в `vitest.config.ts`, не в package.json

4. **Coverage thresholds** сохранены (60% для всех метрик)
