# TD-025: Миграция с Jest на Vitest

**Источник:** Задача 018, td-021, td-024
**Приоритет:** Средний
**Тип:** Инфраструктура

## Описание

Перейти с Jest на Vitest для улучшения поддержки ESM и возможности тестирования сервисов.

## Проблема

Jest плохо поддерживает ESM + Prisma:
- `import.meta.url` не работает в Jest
- `jest.unstable_mockModule` нестабилен
- Требуются сложные workarounds для мокирования

## Преимущества Vitest

- Нативная поддержка ESM
- Совместимость с Jest API (минимальные изменения)
- Быстрее Jest
- Лучшая интеграция с TypeScript
- Hot Module Replacement для тестов

## План миграции

### 1. Установка

```bash
npm install -D vitest @vitest/coverage-v8
npm uninstall jest ts-jest @types/jest
```

### 2. Конфигурация

Создать `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },
  },
});
```

### 3. Обновление тестов

Минимальные изменения:
```typescript
// До (Jest)
import { describe, it, expect, jest } from '@jest/globals';

// После (Vitest)
import { describe, it, expect, vi } from 'vitest';
// jest.fn() → vi.fn()
// jest.mock() → vi.mock()
```

### 4. Обновление package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 5. Удаление Jest

- Удалить `jest.config.js`
- Удалить зависимости Jest

## Файлы для изменения

- `package.json` — скрипты и зависимости
- `jest.config.js` → `vitest.config.ts`
- `src/**/*.test.ts` — замена импортов
- `tsconfig.json` — возможно добавить types

## После миграции

Разблокируются задачи:
- td-021 (unit тесты для сервисов)
- td-022 (integration тесты)

## Оценка

- Сложность: Низкая-Средняя
- Риск: Низкий (API совместим)

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
