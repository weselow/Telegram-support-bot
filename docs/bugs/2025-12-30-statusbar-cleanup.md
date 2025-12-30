# StatusBar Event Listener Cleanup

**Дата:** 2025-12-30
**Источник:** TD-035

## Проблема

В `StatusBar` компоненте кнопка retry добавляла event listener через `addEventListener` без сохранения ссылки для cleanup. При вызове `hide()` listener оставался в памяти.

## Причина

Использование `addEventListener` напрямую вместо паттерна `on()` из `utils/dom.ts`, который возвращает функцию отписки.

## Решение

1. Импортирован `on` из `utils/dom.ts`
2. Добавлено поле `retryUnsubscribe` для хранения функции отписки
3. В `createStatusBar()` используется `on()` вместо `addEventListener`
4. В `hide()` вызывается cleanup перед удалением элемента

## Изменённые файлы

- `chat-widget/src/ui/status.ts` — добавлен cleanup для event listeners

## Важно для разработчика

При добавлении event listeners в компонентах виджета:
- Использовать `on()` из `utils/dom.ts`
- Сохранять возвращаемую функцию отписки
- Вызывать отписку в методе destroy/hide/cleanup
