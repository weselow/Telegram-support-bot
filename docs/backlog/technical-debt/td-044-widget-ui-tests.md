# TD-044: Unit-тесты для UI компонентов виджета

**Дата:** 2025-12-31
**Приоритет:** Средний
**Сложность:** Средняя (2-3 часа)
**Источник:** Code review PR

## Проблема

UI компоненты виджета не покрыты тестами:
- `chat-widget/src/ui/telegram.ts` — компонент связки с Telegram
- `chat-widget/src/ui/status.ts` — StatusBar для отображения состояния

## Что нужно протестировать

### telegram.ts

```typescript
describe('TelegramLink', () => {
  it('should show "Перейти" button when unlinked')
  it('should hide button when linked')
  it('should display username when linked')
  it('should disable button during loading')
  it('should call onLink callback only when unlinked')
  it('should cleanup event listeners on destroy')
})
```

### status.ts

```typescript
describe('StatusBar', () => {
  it('should show connecting status')
  it('should show error status with retry button')
  it('should hide on connected state')
  it('should deduplicate same status updates')
  it('should call onRetry callback')
  it('should cleanup on hide')
})
```

## Файлы для изменения

- Создать: `chat-widget/src/__tests__/ui/telegram.test.ts`
- Создать: `chat-widget/src/__tests__/ui/status.test.ts`

## Метрики успеха

- Покрытие UI компонентов >70%
- Все состояния компонентов протестированы
- Тесты на cleanup проходят
