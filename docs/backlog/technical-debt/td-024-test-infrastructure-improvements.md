# TD-024: Улучшение тестовой инфраструктуры

**Источник:** Задача 018, decisions.md
**Приоритет:** Средний
**Тип:** Архитектурное улучшение

## Описание

Рекомендации по улучшению тестируемости кодовой базы.

## Рекомендации

### 1. Переход на Vitest

**Проблема:** Jest плохо поддерживает ESM + Prisma.

**Решение:** Vitest имеет нативную поддержку ESM и лучше интегрируется с современным TypeScript.

**Шаги:**
- Установить vitest
- Мигрировать jest.config.js → vitest.config.ts
- Обновить тестовые файлы (минимальные изменения)

### 2. Dependency Injection

**Проблема:** Сервисы импортируют зависимости напрямую, что затрудняет мокирование.

**Решение:** Передавать зависимости через параметры или использовать DI-контейнер.

**Пример:**
```typescript
// До
import { userRepository } from '../db/repositories/user.repository.js';
export async function findUserByTgId(tgUserId: bigint) {
  return userRepository.findByTgUserId(tgUserId);
}

// После
export function createTicketService(deps: { userRepository: IUserRepository }) {
  return {
    findUserByTgId: (tgUserId: bigint) => deps.userRepository.findByTgUserId(tgUserId),
  };
}
```

### 3. Отдельные pure-function модули

**Проблема:** Бизнес-логика смешана с инфраструктурным кодом.

**Решение:** Выносить чистые функции в отдельные модули без зависимостей.

**Пример:**
- `src/utils/sla-calculator.ts` - расчёт SLA таймингов
- `src/utils/status-transitions.ts` - валидация переходов статусов
- `src/utils/message-filters.ts` - фильтрация internal сообщений

## Связанные файлы

- docs/solutions/018-tests/decisions.md
- td-021-service-unit-tests.md
