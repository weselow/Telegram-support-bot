# Chat Widget: Переключатель modal/drawer

**Дата:** 2025-12-30
**Источник:** TD-032

## Проблема

Пользователь не мог переключаться между режимами отображения виджета (modal/drawer) после открытия чата.

## Причина

Изначально режим отображения определялся автоматически (`variant: 'auto'`) в зависимости от ширины экрана. UI-элементы для ручного переключения отсутствовали.

## Решение

Добавлены Windows-style кнопки управления окном в header виджета:

1. **Minimize (—)** — сворачивает чат в кнопку (аналогично Close)
2. **Toggle (□/❐)** — переключает режим modal↔drawer
3. **Close (✕)** — закрывает чат

### Особенности:
- Minimize и Toggle скрыты на мобильных устройствах (max-width: 480px)
- Иконка Toggle меняется в зависимости от текущего режима:
  - `□` (windowMaximize) — в режиме modal
  - `❐` (windowRestore) — в режиме drawer

## Изменённые файлы

- `chat-widget/src/ui/icons.ts` — добавлены иконки windowMaximize и windowRestore
- `chat-widget/src/ui/header.ts` — расширен интерфейс ChatHeaderOptions, добавлена кнопка toggle
- `chat-widget/src/widget.ts` — добавлен метод toggleVariant(), переданы опции в header
- `chat-widget/src/styles/base.css` — добавлен CSS для скрытия на мобильных

## Важно для разработчика

- Кнопки Minimize и Toggle имеют класс `chat-header__btn--desktop-only`
- При переключении режима контейнер полностью пересоздаётся (через setVariant)
- Выбранный режим сохраняется в localStorage
