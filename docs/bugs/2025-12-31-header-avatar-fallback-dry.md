# ChatHeader: DRY для avatar fallback

**Дата:** 2025-12-31
**Источник:** TD-048

## Проблема

В `chat-widget/src/ui/header.ts` дублировался код показа fallback-иконки (3 места):
- В `setAvatar()` — обработчик `img.onerror`
- В `createHeader()` — обработчик `img.onerror`  
- В `createHeader()` — ветка `else` для дефолтной иконки

## Решение

Создан приватный метод `showFallbackIcon()`:

```typescript
private showFallbackIcon(): void {
  if (!this.avatarElement) return
  this.avatarElement.innerHTML = ''
  const iconWrapper = document.createElement('div')
  iconWrapper.innerHTML = icons.support
  const svg = iconWrapper.firstElementChild
  if (svg) this.avatarElement.appendChild(svg)
}
```

Все 3 места теперь вызывают этот метод.

## Изменённые файлы

- `chat-widget/src/ui/header.ts` — добавлен метод, устранено дублирование

## Важно для разработчика

- Логика fallback теперь в одном месте
- При необходимости изменить иконку — правка только в `showFallbackIcon()`
