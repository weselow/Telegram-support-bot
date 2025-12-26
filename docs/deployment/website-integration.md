# Интеграция с сайтом

## Обзор

Пользователь кликает кнопку "Поддержка" на сайте → открывается Telegram с ботом → бот знает откуда пришёл пользователь.

## Deep Link формат

```
https://t.me/BOT_USERNAME?start=PAYLOAD
```

**PAYLOAD** содержит:
- URL страницы (откуда пришёл пользователь)
- Timestamp (для проверки актуальности)
- HMAC подпись (защита от подделки)

---

## Генерация ссылки на сервере

### Формат payload

```
base64url(url) + "." + timestamp + "." + hmac_signature
```

### Пример на JavaScript (Node.js)

```javascript
import crypto from 'crypto';

const BOT_USERNAME = 'your_support_bot';
const SECRET_KEY = process.env.SUPPORT_LINK_SECRET; // секретный ключ
const LINK_TTL = 24 * 60 * 60; // 24 часа

function generateSupportLink(pageUrl) {
  const timestamp = Math.floor(Date.now() / 1000);

  // Base64url encode URL
  const urlEncoded = Buffer.from(pageUrl)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Create signature
  const dataToSign = `${urlEncoded}.${timestamp}`;
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(dataToSign)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .slice(0, 16); // короткая подпись

  const payload = `${urlEncoded}.${timestamp}.${signature}`;

  return `https://t.me/${BOT_USERNAME}?start=${payload}`;
}

// Использование
const link = generateSupportLink('https://example.com/product/123');
// => https://t.me/your_support_bot?start=aHR0cHM6Ly9leGFtcGxl...
```

### Пример на PHP

```php
<?php
const BOT_USERNAME = 'your_support_bot';
const SECRET_KEY = 'your-secret-key';

function generateSupportLink(string $pageUrl): string {
    $timestamp = time();

    // Base64url encode
    $urlEncoded = rtrim(strtr(base64_encode($pageUrl), '+/', '-_'), '=');

    // Create signature
    $dataToSign = "{$urlEncoded}.{$timestamp}";
    $signature = substr(
        rtrim(strtr(base64_encode(hash_hmac('sha256', $dataToSign, SECRET_KEY, true)), '+/', '-_'), '='),
        0, 16
    );

    $payload = "{$urlEncoded}.{$timestamp}.{$signature}";

    return "https://t.me/" . BOT_USERNAME . "?start={$payload}";
}
```

---

## Кнопка на сайте

### HTML

```html
<a href="https://t.me/your_bot?start=PAYLOAD"
   target="_blank"
   class="support-button">
  💬 Нужна помощь?
</a>
```

### React компонент

```jsx
function SupportButton({ pageUrl }) {
  const [link, setLink] = useState(null);

  useEffect(() => {
    fetch('/api/support-link', {
      method: 'POST',
      body: JSON.stringify({ url: pageUrl })
    })
      .then(res => res.json())
      .then(data => setLink(data.link));
  }, [pageUrl]);

  if (!link) return null;

  return (
    <a href={link} target="_blank" rel="noopener noreferrer">
      💬 Нужна помощь?
    </a>
  );
}
```

---

## Валидация в боте

Бот при получении `/start PAYLOAD`:

1. **Разбирает payload** на части: `urlEncoded.timestamp.signature`
2. **Проверяет подпись** — пересчитывает HMAC и сравнивает
3. **Проверяет timestamp** — не старше 24 часов
4. **Декодирует URL** — сохраняет как контекст обращения

```typescript
function validatePayload(payload: string): { url: string } | null {
  const parts = payload.split('.');
  if (parts.length !== 3) return null;

  const [urlEncoded, timestamp, signature] = parts;

  // Check timestamp (24h TTL)
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - ts > 24 * 60 * 60) return null;

  // Verify signature
  const expectedSig = createHmac(...)...;
  if (signature !== expectedSig) return null;

  // Decode URL
  const url = Buffer.from(urlEncoded, 'base64url').toString('utf8');

  return { url };
}
```

---

## Флоу пользователя

```
1. Клик по кнопке на сайте
   ↓
2. Открывается Telegram → бот
   ↓
3. Бот: "Здравствуйте! Вижу, вы пришли со страницы: [Product Name]"
   ↓
4. Бот: "Поделитесь номером телефона для связи"
   [📱 Отправить контакт]  [Пропустить]
   ↓
5. Пользователь отправляет контакт (или пропускает)
   ↓
6. Бот: "Опишите вашу проблему"
   ↓
7. Пользователь пишет сообщение
   ↓
8. Создаётся тикет, сообщение пересылается в топик поддержки
```

---

## Статус реализации

| Компонент | Статус |
|-----------|--------|
| Deep link формат | ✅ Спроектирован |
| Генерация ссылки (примеры) | ✅ Документация |
| Валидация payload в боте | ⏳ TODO |
| Сохранение source URL | ⏳ TODO |
| Запрос телефона при старте | ✅ Частично (есть phone handler) |
| Полный onboarding flow | ⏳ TODO |

---

## Переменные окружения

Добавить в `.env`:

```env
# Secret key for signing support links (generate random string)
SUPPORT_LINK_SECRET=your-random-secret-key-here
```

Сгенерировать ключ:
```bash
openssl rand -base64 32
```
