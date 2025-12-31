# TD-048: Рефакторинг ChatHeader - DRY для avatar fallback

**Приоритет:** Низкий
**Источник:** Code Review TD-040

## Проблема

В `chat-widget/src/ui/header.ts` дублируется код fallback для аватара:

```typescript
// Дублируется в setAvatar() и createHeader()
img.onerror = () => {
  img.remove()
  const iconWrapper = document.createElement('div')
  iconWrapper.innerHTML = icons.support
  const svg = iconWrapper.firstElementChild
  if (svg && this.avatarElement) this.avatarElement.appendChild(svg)
}
```

## Решение

Вынести в приватный метод:
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

## Критерии готовности

- [ ] Метод создан
- [ ] Дублирование устранено
- [ ] Widget работает корректно
