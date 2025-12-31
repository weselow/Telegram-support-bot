# TD-050: Magic bytes validation для файлов

**Статус:** TODO
**Приоритет:** Средний
**Источник:** Task 023 (Web Chat File Upload)

## Проблема

Текущая валидация файлов проверяет только MIME type из заголовка запроса. Это ненадёжно — злоумышленник может отправить `.exe` с MIME type `image/jpeg`.

## Решение

Проверять реальный тип файла по magic bytes (сигнатуре в начале файла):

```typescript
const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/zip': [0x50, 0x4B, 0x03, 0x04],
  // ...
};
```

## Требования

- Проверка первых N байт файла
- Сопоставление с заявленным MIME type
- Отклонение при несовпадении

## Изменяемые файлы

- `src/utils/file-validation.ts` - добавить `validateMagicBytes()`
- `src/http/routes/chat.ts` - вызов валидации

## Библиотеки

Можно использовать `file-type` npm пакет или написать свою проверку.

## Оценка

~2 часа работы
