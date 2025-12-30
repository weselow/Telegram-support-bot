# TD-045: Предупреждение при использовании неинициализированного ErrorLogger

**Дата:** 2025-12-31
**Приоритет:** Низкий
**Сложность:** Низкая (30 минут)
**Источник:** Code review PR

## Проблема

Если `errorLogger.init()` не был вызван, все ошибки молча отбрасываются без предупреждения. Разработчик может случайно забыть инициализировать логгер.

Текущее поведение в `addToQueue()`:
```typescript
if (!this.initialized) return  // Молча игнорирует
```

## Решение

Добавить предупреждение при первой попытке использовать неинициализированный логгер:

```typescript
private warnedAboutInit = false

private addToQueue(...): void {
  if (!this.initialized) {
    if (!this.warnedAboutInit) {
      console.warn('[ChatWidget] ErrorLogger not initialized, errors will not be logged')
      this.warnedAboutInit = true
    }
    return
  }
  // ...
}
```

## Файлы для изменения

- `chat-widget/src/utils/error-logger.ts`

## Метрики успеха

- Предупреждение выводится один раз при первом использовании без init
- Существующие тесты проходят
- Добавлен тест на предупреждение
