# TD-006: ESM/Prisma Test Infrastructure

## Проблема

Jest не может корректно мокать модули, которые импортируют Prisma Client в ESM режиме. При попытке запуска тестов для `callback.ts` и других хендлеров, зависящих от БД, возникает ошибка:

```
SyntaxError: Cannot use 'import.meta' outside a module
```

Это происходит потому что:
1. Prisma Client генерирует код с `import.meta.url`
2. Jest ESM support через `jest.unstable_mockModule` не перехватывает импорты до их резолва
3. Цепочка импортов: `callback.ts` → `user.repository.ts` → `db/client.ts` → `prisma/client.ts`

## Затронутые файлы

- `src/bot/handlers/callback.ts` - нет тестов
- `src/bot/handlers/message.ts` - нет тестов (excluded в jest.config)
- `src/bot/handlers/support.ts` - нет тестов
- `src/services/topic.service.ts` - нет тестов (excluded в jest.config)

## Возможные решения

1. **Dependency Injection** - передавать репозитории как параметры вместо прямого импорта
2. **Manual mocks** - создать `__mocks__` директории для всей цепочки зависимостей
3. **Vitest** - использовать Vitest вместо Jest (лучшая ESM поддержка)
4. **Отдельный тест-раннер** - использовать отдельную конфигурацию для интеграционных тестов

## Приоритет

Средний - функциональность работает, но покрытие тестами недостаточное.

## Связанные задачи

- TD-005: Support handler tests

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
