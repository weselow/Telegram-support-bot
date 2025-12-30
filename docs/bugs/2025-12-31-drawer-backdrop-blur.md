# Chat Widget: Drawer backdrop blur блокирует чат

**Дата:** 2025-12-31
**Источник:** TD-039

## Проблема

В drawer режиме виджета:
1. `backdrop-filter: blur(4px)` размывал весь экран за overlay
2. Overlay имел z-index выше чем container (10000 vs 9999), полностью перекрывая чат

## Причина

1. CSS overlay использовал `backdrop-filter: blur()` — размытие фона
2. **Главная причина:** Неправильный z-index порядок в base.css:
   - `--chat-z-widget: 9999` (контейнер чата)
   - `--chat-z-overlay: 10000` (overlay ВЫШЕ чата!)

## Решение

1. **Исправлен z-index порядок** в `base.css`:
   - `--chat-z-overlay: 9999` (теперь overlay ПОД чатом)
   - `--chat-z-widget: 10000` (чат поверх overlay)
2. Удален `backdrop-filter` и `-webkit-backdrop-filter` — убрано размытие фона
3. Уменьшена непрозрачность overlay с 0.5 до 0.4
4. Добавлен `pointer-events: none/auto` для корректной обработки кликов

## Изменённые файлы

- `chat-widget/src/styles/base.css` — исправлен z-index порядок
- `chat-widget/src/styles/drawer.css` — удален backdrop blur, исправлена интерактивность overlay

## Важно для разработчика

- z-index порядок: button (9998) < overlay (9999) < widget (10000)
- Drawer overlay теперь не блокирует взаимодействие с чатом
- Клик по затемненной области вне drawer закрывает виджет
