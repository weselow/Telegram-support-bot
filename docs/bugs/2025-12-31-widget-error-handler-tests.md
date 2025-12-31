# Widget Error Logger: тесты globalErrorHandler

**Дата:** 2025-12-31
**Источник:** TD-041

## Проблема

Тестовое покрытие error-logger.ts составляло ~85%. Не были покрыты тестами:
- `globalErrorHandler` (window.onerror)
- `rejectionHandler` (unhandledrejection)
- `maxQueueSize` overflow

## Решение

Добавлены 7 новых тестов в `chat-widget/src/__tests__/utils/error-logger.test.ts`:

### globalErrorHandler (3 теста)
1. Фильтрация cross-origin ошибок ("Script error.")
2. Включение file info (filename, lineno, colno) в контекст
3. Захват stack trace из ErrorEvent.error

### rejectionHandler (3 теста)
1. Логирование unhandled promise rejections со строковым reason
2. Захват stack trace при rejection с Error объектом
3. Обработка rejection с примитивным значением (number)

### maxQueueSize (1 тест)
1. Сброс ошибок при переполнении очереди

## Изменённые файлы

- `chat-widget/src/__tests__/utils/error-logger.test.ts` — добавлены 7 тестов

## Результаты

- Всего тестов в error-logger.test.ts: 21
- Все тесты проходят
- Покрытие error-logger.ts: >95%
