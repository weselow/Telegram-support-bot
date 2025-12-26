# TD-017: formatMessage молча игнорирует несуществующие ключи

## Проблема

В `src/config/messages.ts` функция `formatMessage` при отсутствии ключа в переданных переменных молча возвращает оригинальный placeholder вместо ошибки.

## Текущее поведение

```typescript
export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value !== undefined ? String(value) : match; // Возвращает {key} как есть
  });
}
```

## Последствия

- Опечатки в именах placeholder'ов не обнаруживаются
- В production может отображаться `{userNmae}` вместо имени пользователя

## Предлагаемое решение

Добавить опциональный strict mode:
```typescript
export function formatMessage(
  template: string,
  vars: Record<string, string | number>,
  options?: { strict?: boolean }
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key];
    if (value === undefined && options?.strict) {
      throw new Error(`Missing placeholder value: ${key}`);
    }
    return value !== undefined ? String(value) : match;
  });
}
```

## Приоритет

Низкий — текущее поведение намеренное для гибкости.

## Источник

Code review для задачи 015.

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
