# TD-035: Chat Widget — Cleanup event listeners в StatusBar

**Приоритет:** Low
**Статус:** В ожидании
**Модуль:** chat-widget

## Описание

В StatusBar компоненте retry button добавляет event listener без сохранения ссылки для cleanup.

## Текущий код

```typescript
// chat-widget/src/ui/status.ts
retryBtn.addEventListener('click', () => {
  this.options.onRetry?.()
})
```

## Почему Low приоритет

- StatusBar живёт всю жизнь виджета
- Retry button пересоздаётся редко
- Утечка памяти минимальна

## Предлагаемое решение

Использовать паттерн `on()` из `utils/dom.ts`:

```typescript
private retryUnsubscribe?: () => void

private showRetry(): void {
  const retryBtn = createElement('button', ...)
  this.retryUnsubscribe = on(retryBtn, 'click', () => {
    this.options.onRetry?.()
  })
}

destroy(): void {
  this.retryUnsubscribe?.()
  // ...
}
```

## Связанные файлы

- `chat-widget/src/ui/status.ts`
- `chat-widget/src/utils/dom.ts` — паттерн `on()`
