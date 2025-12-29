# Decisions: CORS Configuration

## Контекст

Текущая реализация CORS в `src/http/routes/chat.ts` поддерживает только один origin и использует хрупкую логику `replace('chat.', '')`. Нужна гибкая система, разрешающая основной домен и все поддомены.

## Принятые решения

1. **Извлечение базового домена** — из `SUPPORT_DOMAIN=chat.dellshop.ru` берём последние 2 части → `dellshop.ru`
2. **Wildcard для поддоменов** — разрешаем `*.dellshop.ru` через проверку suffix
3. **Dev-режим** — автоматически разрешаем `localhost` в development
4. **Общий utils** — `src/utils/cors.ts` используется и HTTP, и WebSocket
5. **TD-034 интегрирован** — WebSocket Origin validation делаем в этой же задаче

## Что реализовано

- [x] `src/utils/cors.ts` с функциями `getBaseDomain`, `isOriginAllowed`, `getConfiguredBaseDomain`, `isOriginAllowedByConfig`
- [x] Обновлён `src/http/routes/chat.ts` — динамическая проверка Origin
- [x] Добавлена проверка Origin в WebSocket handler (TD-034)
- [x] Unit-тесты для CORS функций (21 тест, 100% покрытие)

## Технические детали

### Алгоритм проверки Origin

```
Origin: https://www.dellshop.ru
SUPPORT_DOMAIN: chat.dellshop.ru
         ↓
Base domain: dellshop.ru
         ↓
Check: www.dellshop.ru ends with .dellshop.ru? → YES → ALLOWED
```
