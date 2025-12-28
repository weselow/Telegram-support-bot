# DellShop Live Chat Widget

> Встраиваемый виджет чата для поддержки клиентов на сайте dellshop.ru / rackparts.ru

## Обзор

Независимый JavaScript-виджет для живого чата с поддержкой. Работает через WebSocket для real-time обмена сообщениями, поддерживает интеграцию с Telegram.

## Ключевые особенности

- **Независимый скрипт** - не требует React/Next.js, работает на любом сайте
- **Два варианта дизайна** - floating modal и full-height drawer
- **Real-time** - WebSocket подключение для мгновенных сообщений
- **Telegram интеграция** - продолжение диалога в Telegram
- **Offline режим** - форма обратной связи когда операторы недоступны
- **Cookie сессия** - автоматическое сохранение истории между визитами
- **Минимальный размер** - цель ~15-20KB gzipped
- **Lazy loading** - не блокирует загрузку страницы

## Быстрый старт

### Простое подключение

```html
<!-- В конце <body> -->
<script src="https://cdn.dellshop.ru/chat-widget.js" async></script>
```

### С настройками

```html
<script
  src="https://cdn.dellshop.ru/chat-widget.js"
  data-variant="drawer"
  data-position="bottom-right"
  async
></script>
```

### Программная инициализация

```html
<script src="https://cdn.dellshop.ru/chat-widget.js" async></script>
<script>
  window.DellShopChatConfig = {
    variant: 'auto',           // 'modal' | 'drawer' | 'auto'
    position: 'bottom-right',  // 'bottom-right' | 'bottom-left'
    responsive: {
      mobile: 'drawer',
      desktop: 'modal'
    },
    theme: {
      brandColor: '#1e3a8a'
    }
  }
</script>
```

## Документация

- [Архитектура](./architecture.md) - технические решения и структура
- [Варианты дизайна](./design-variants.md) - modal vs drawer
- [API интеграция](./api-integration.md) - работа с бекендом
- [Backend API спецификация](./backend-api-spec.md) - WebSocket/HTTP протокол
- [Стилизация](./styling.md) - кастомизация внешнего вида
- [TODO / Тех. долг](./TODO.md) - открытые вопросы и задачи

## Визуальные превью

- `../mockup.html` - превью floating modal варианта
- `../mockup-drawer.html` - превью full-height drawer варианта

## Разработка

```bash
# Установка зависимостей
cd chat-widget
npm install

# Разработка с hot-reload
npm run dev

# Сборка для production
npm run build

# Запуск тестов
npm test
```

## Статус проекта

**Фаза**: Проектирование (Phase 4)
**Версия**: 0.1.0-design

## Связанные документы

- Оригинал API спецификации: `docs/widget-developer-guide.md` (в корне проекта)
