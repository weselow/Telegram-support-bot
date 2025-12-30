# Chat Widget: Drawer backdrop blur блокирует чат

**Дата:** 2025-12-31
**Источник:** TD-039

## Проблема

В drawer режиме виджета:
1. `backdrop-filter: blur(4px)` размывал весь экран за overlay
2. Overlay занимал весь экран (`inset: 0`) и перекрывал доступ к чату

## Причина

CSS overlay использовал `backdrop-filter: blur()`, что создавало визуальный эффект размытия, но также overlay был позиционирован поверх чата, блокируя взаимодействие.

## Решение

1. Удален `backdrop-filter` и `-webkit-backdrop-filter` — убрано размытие фона
2. Уменьшена непрозрачность overlay с 0.5 до 0.4 — менее навязчивое затемнение
3. Добавлен `pointer-events: none` по умолчанию — overlay не перехватывает клики
4. `pointer-events: auto` только для видимого overlay — клик по overlay закрывает drawer

## Изменённые файлы

- `chat-widget/src/styles/drawer.css` — удален backdrop blur, исправлена интерактивность overlay

## Важно для разработчика

- Drawer overlay теперь не блокирует взаимодействие с чатом
- Клик по затемненной области вне drawer по-прежнему закрывает виджет (ожидаемое поведение)
- Для полного отключения overlay можно использовать класс `chat-widget--no-overlay`
