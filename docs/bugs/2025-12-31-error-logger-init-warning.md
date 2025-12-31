# ErrorLogger: предупреждение при использовании без init()

**Дата:** 2025-12-31
**Источник:** TD-045

## Проблема

Если `errorLogger.init()` не был вызван, все ошибки молча отбрасывались без предупреждения. Разработчик мог случайно забыть инициализировать логгер и не понять, почему ошибки не логируются.

## Решение

Добавлено однократное предупреждение при первой попытке использовать неинициализированный логгер:

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

Флаг `warnedAboutInit` сбрасывается в методе `destroy()` для корректной работы при повторной инициализации.

## Изменённые файлы

- `chat-widget/src/utils/error-logger.ts` — добавлено предупреждение
- `chat-widget/src/__tests__/utils/error-logger.test.ts` — добавлено 2 теста

## Тесты

**initialization warning (2 теста)**
- Предупреждение выводится один раз при использовании без init
- Флаг сбрасывается после destroy

## Результаты

- Все 171 тест проходят
- Улучшен developer experience: разработчик сразу видит проблему
