# Unit-тесты для UI компонентов виджета

**Дата:** 2025-12-31
**Источник:** TD-044

## Проблема

UI компоненты виджета не были покрыты тестами:
- `TelegramLink` — кнопка связки с Telegram
- `StatusBar` — индикатор статуса соединения

## Решение

Созданы два файла с тестами:

### telegram.test.ts (15 тестов)

**initial state (3 теста)**
- Скрыт по умолчанию
- Показывает кнопку "Перейти" когда не связан
- Показывает текст "Продолжить в Telegram?"

**setLinked (2 теста)**
- Скрывает кнопку когда связан
- Показывает username когда связан

**setUnlinked (2 теста)**
- Показывает кнопку после отвязки
- Восстанавливает текст по умолчанию

**setLoading (2 теста)**
- Деактивирует кнопку во время загрузки
- Активирует кнопку после загрузки

**onLink callback (2 теста)**
- Вызывает callback при клике когда не связан
- Не вызывает callback когда связан

**destroy (2 теста)**
- Удаляет элемент из DOM
- Очищает event listeners

**show/hide (2 теста)**
- Показывает элемент
- Скрывает элемент

### status.test.ts (19 тестов)

**show (6 тестов)**
- Показывает connecting статус со спиннером
- Показывает reconnecting статус со спиннером
- Показывает disconnected статус без спиннера
- Показывает error статус с кнопкой retry
- Не показывает retry если нет callback
- Проверяет ARIA атрибуты

**hide (2 теста)**
- Удаляет status bar из DOM
- Очищает listener кнопки retry

**deduplication (2 теста)**
- Не пересоздаёт bar для того же типа
- Пересоздаёт bar для другого типа

**updateFromConnectionState (4 теста)**
- Показывает connecting для connecting state
- Показывает reconnecting для reconnecting state
- Показывает disconnected для disconnected state
- Скрывает bar для connected state

**showError (1 тест)**
- Показывает error с кастомным сообщением

**onRetry callback (2 теста)**
- Вызывает onRetry при клике
- Вызывает onRetry множественно

**default messages (2 теста)**
- Использует default message для connecting
- Использует default message для error

## Изменённые файлы

- Создан: `chat-widget/src/__tests__/ui/telegram.test.ts` — 15 тестов
- Создан: `chat-widget/src/__tests__/ui/status.test.ts` — 19 тестов

## Результаты

- Всего новых тестов: 34
- Все тесты проходят
- Покрытие UI компонентов: >80%
