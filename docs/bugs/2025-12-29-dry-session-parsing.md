# DRY: Session Parsing

**Дата:** 2025-12-29
**Источник:** TD-025

## Проблема

Дублирование кода парсинга сессии в двух файлах:
- `src/http/routes/chat.ts` — функция `getSessionId()`
- `src/http/ws/websocket.ts` — функция `getSessionIdFromCookie()`

Также дублировались константы:
- `SESSION_COOKIE_NAME = 'webchat_session'`
- `UUID_REGEX` для валидации формата

## Причина

Код писался инкрементально, и при добавлении WebSocket функциональность была скопирована вместо переиспользования.

## Решение

Создан shared модуль `src/http/utils/session.ts` с экспортами:

- `SESSION_COOKIE_NAME` — имя cookie
- `SESSION_COOKIE_MAX_AGE` — время жизни cookie
- `UUID_REGEX` — регулярка для валидации UUID v4
- `isValidSessionId()` — валидация строки как UUID v4
- `parseSessionIdFromCookie()` — извлечение session ID из cookie header

## Изменённые файлы

- `src/http/utils/session.ts` — создан shared модуль
- `src/http/utils/__tests__/session.test.ts` — 18 unit-тестов
- `src/http/routes/chat.ts` — рефакторинг на использование shared модуля
- `src/http/ws/websocket.ts` — рефакторинг на использование shared модуля

## Важно для разработчика

Все функции для работы с сессиями теперь в `src/http/utils/session.ts`. При добавлении новых endpoint'ов использовать:

```typescript
import { parseSessionIdFromCookie, isValidSessionId } from '../utils/session.js';
```
