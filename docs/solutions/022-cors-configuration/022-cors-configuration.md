# 022 - CORS Configuration

**Статус:** DONE
**Приоритет:** Высокий
**Включает:** TD-034 (WebSocket Origin validation) — закрыт

## Проблема

Текущая реализация CORS в `src/http/routes/chat.ts`:
- Поддерживает только один origin
- Использует хрупкую логику `replace('chat.', '')`
- Не покрывает `www.` вариант домена
- Не поддерживает dev/staging окружения
- WebSocket не проверяет Origin

## Требования

1. Разрешить CORS для основного домена и всех поддоменов
2. Автоматически определять домен из `SUPPORT_DOMAIN`
3. В dev-режиме разрешать localhost
4. Применить те же правила к WebSocket

## Предлагаемое решение

### Логика определения разрешённых origins

Из `SUPPORT_DOMAIN=chat.dellshop.ru` извлекать базовый домен `dellshop.ru`:

```
Разрешены:
- https://dellshop.ru        (основной)
- https://*.dellshop.ru      (любой поддомен: www, chat, staging, etc.)

В dev-режиме дополнительно:
- http://localhost:*         (любой порт)
```

### Алгоритм извлечения базового домена

```typescript
function getBaseDomain(supportDomain: string): string {
  // chat.dellshop.ru → dellshop.ru
  // www.shop.dellshop.ru → dellshop.ru
  const parts = supportDomain.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');  // последние 2 части
  }
  return supportDomain;
}
```

### Функция проверки Origin

```typescript
function isOriginAllowed(origin: string | undefined, baseDomain: string): boolean {
  if (!origin) return false;

  try {
    const url = new URL(origin);
    const host = url.hostname;

    // Exact match: dellshop.ru
    if (host === baseDomain) return true;

    // Subdomain match: *.dellshop.ru
    if (host.endsWith('.' + baseDomain)) return true;

    // Dev mode: localhost
    if (env.NODE_ENV === 'development' && host === 'localhost') return true;

    return false;
  } catch {
    return false;
  }
}
```

### CORS Middleware

```typescript
function setCorsHeaders(request: FastifyRequest, reply: FastifyReply): boolean {
  const origin = request.headers.origin;
  const baseDomain = getBaseDomain(env.SUPPORT_DOMAIN || '');

  if (!baseDomain || !isOriginAllowed(origin, baseDomain)) {
    return false;  // Origin не разрешён
  }

  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  reply.header('Access-Control-Max-Age', '86400');

  return true;
}
```

## Файлы для изменения

1. `src/config/env.ts` — без изменений (используем существующий `SUPPORT_DOMAIN`)
2. `src/http/routes/chat.ts` — новая логика CORS
3. `src/http/ws/handler.ts` — проверка Origin для WebSocket (интегрировать TD-034)
4. Вынести общую логику в `src/utils/cors.ts`

## Подзадачи

- [x] Создать `src/utils/cors.ts` с функциями `getBaseDomain`, `isOriginAllowed`
- [x] Обновить `src/http/routes/chat.ts` для использования новой логики
- [x] Добавить проверку Origin в WebSocket handler (`src/http/ws/websocket.ts`) — **TD-034**
- [x] Написать unit-тесты для CORS функций (21 тест, 100% покрытие)
- [x] Протестировать с разных доменов (dellshop.ru, www.dellshop.ru, localhost)
- [x] Закрыть TD-034 в backlog README

## Примеры

| SUPPORT_DOMAIN | Базовый домен | Разрешённые origins |
|----------------|---------------|---------------------|
| chat.dellshop.ru | dellshop.ru | https://dellshop.ru, https://*.dellshop.ru |
| api.staging.example.com | example.com | https://example.com, https://*.example.com |
| localhost:3001 | localhost:3001 | http://localhost:* |

## Безопасность

- Без `SUPPORT_DOMAIN` CORS отключен (запросы отклоняются)
- Проверка применяется и к HTTP, и к WebSocket
- Не используем `Access-Control-Allow-Origin: *` с credentials

## Тестирование

```bash
# Должен работать
curl -H "Origin: https://dellshop.ru" https://chat.dellshop.ru/api/chat/init
curl -H "Origin: https://www.dellshop.ru" https://chat.dellshop.ru/api/chat/init

# Должен быть отклонён
curl -H "Origin: https://evil.com" https://chat.dellshop.ru/api/chat/init
```
