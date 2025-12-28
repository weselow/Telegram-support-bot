# Database Changes for Web Chat API

## Обзор изменений

Для поддержки веб-чата необходимы минимальные изменения в схеме БД:
- Добавление `webSessionId` в таблицу `users`
- Добавление `channel` в таблицу `messages_map`
- Новая таблица `web_link_tokens` для миграции в Telegram

---

## Prisma Schema Changes

### 1. Модель User

```prisma
model User {
  id            String    @id @default(uuid())

  // Telegram идентификация (nullable для web-only пользователей)
  tgUserId      BigInt?   @unique @map("tg_user_id")
  tgUsername    String?   @map("tg_username")
  tgFirstName   String?   @map("tg_first_name")
  tgLastName    String?   @map("tg_last_name")

  // Web идентификация (nullable для telegram-only пользователей)
  webSessionId  String?   @unique @map("web_session_id")

  // Общие поля
  topicId       Int?      @map("topic_id")
  status        TicketStatus @default(NEW)
  sourceUrl     String?   @map("source_url")
  sourceCity    String?   @map("source_city")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  messages      MessageMap[]
  linkTokens    WebLinkToken[]

  @@map("users")
}
```

**Изменения:**
- `tgUserId` стал `nullable` (ранее обязателен)
- Добавлен `webSessionId` (UUID из cookie)
- User может иметь только `webSessionId`, только `tgUserId`, или **оба**

---

### 2. Модель MessageMap

```prisma
enum MessageChannel {
  TELEGRAM
  WEB
}

model MessageMap {
  id              String    @id @default(uuid())

  // Связь с пользователем
  userId          String    @map("user_id")
  user            User      @relation(fields: [userId], references: [id])

  // ID сообщений
  userMessageId   String?   @map("user_message_id")    // ID в DM/WebSocket
  topicMessageId  Int?      @map("topic_message_id")   // ID в топике группы

  // Канал источника
  channel         MessageChannel @default(TELEGRAM)

  // Контент (для web сообщений без Telegram ID)
  text            String?

  // Timestamps
  createdAt       DateTime  @default(now()) @map("created_at")

  @@index([userId])
  @@index([userMessageId])
  @@index([topicMessageId])
  @@map("messages_map")
}
```

**Изменения:**
- Добавлен enum `MessageChannel`
- Добавлено поле `channel` для определения источника
- Добавлено поле `text` для хранения контента веб-сообщений
- `userMessageId` теперь `String?` (не BigInt) для поддержки UUID

---

### 3. Новая модель WebLinkToken

```prisma
model WebLinkToken {
  id          String    @id @default(uuid())

  // Связь с пользователем
  userId      String    @map("user_id")
  user        User      @relation(fields: [userId], references: [id])

  // Токен для deep link
  token       String    @unique

  // Срок действия
  expiresAt   DateTime  @map("expires_at")

  // Использован ли
  usedAt      DateTime? @map("used_at")

  createdAt   DateTime  @default(now()) @map("created_at")

  @@index([token])
  @@index([expiresAt])
  @@map("web_link_tokens")
}
```

**Назначение:**
- Хранит токены для миграции Web → Telegram
- `token` используется в deep link: `t.me/bot?start=link_<token>`
- TTL: 1 час (`expiresAt`)
- После использования помечается `usedAt`

---

## Migration SQL

```sql
-- 1. Изменение таблицы users
ALTER TABLE users
  ALTER COLUMN tg_user_id DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN web_session_id VARCHAR(255) UNIQUE;

-- 2. Добавление channel в messages_map
CREATE TYPE message_channel AS ENUM ('TELEGRAM', 'WEB');

ALTER TABLE messages_map
  ADD COLUMN channel message_channel NOT NULL DEFAULT 'TELEGRAM';

ALTER TABLE messages_map
  ADD COLUMN text TEXT;

ALTER TABLE messages_map
  ALTER COLUMN user_message_id TYPE VARCHAR(255);

-- 3. Создание таблицы web_link_tokens
CREATE TABLE web_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_web_link_tokens_token ON web_link_tokens(token);
CREATE INDEX idx_web_link_tokens_expires ON web_link_tokens(expires_at);

-- 4. Индекс для быстрого поиска по web_session_id
CREATE INDEX idx_users_web_session ON users(web_session_id)
  WHERE web_session_id IS NOT NULL;
```

---

## Repository Changes

### UserRepository

```typescript
// Новые методы
interface IUserRepository {
  // Существующие
  findByTelegramId(tgUserId: bigint): Promise<User | null>

  // Новые для веб-чата
  findByWebSessionId(sessionId: string): Promise<User | null>
  createWebUser(sessionId: string): Promise<User>
  linkTelegramAccount(userId: string, tgUserId: bigint): Promise<User>
  findByWebOrTelegram(sessionId?: string, tgUserId?: bigint): Promise<User | null>
}
```

### MessageMapRepository

```typescript
// Новые методы
interface IMessageMapRepository {
  // Существующие
  findByUserMessageId(messageId: bigint): Promise<MessageMap | null>

  // Новые для веб-чата
  createWebMessage(data: CreateWebMessageDTO): Promise<MessageMap>
  findByChannel(userId: string, channel: MessageChannel): Promise<MessageMap[]>
  getHistory(userId: string, options: HistoryOptions): Promise<MessageMap[]>
}
```

### WebLinkTokenRepository (новый)

```typescript
interface IWebLinkTokenRepository {
  create(userId: string, expiresAt: Date): Promise<WebLinkToken>
  findByToken(token: string): Promise<WebLinkToken | null>
  markUsed(tokenId: string): Promise<void>
  deleteExpired(): Promise<number>
}
```

---

## Data Integrity

### Constraints

1. **User должен иметь хотя бы один идентификатор:**
```sql
ALTER TABLE users ADD CONSTRAINT user_has_identifier
  CHECK (tg_user_id IS NOT NULL OR web_session_id IS NOT NULL);
```

2. **MessageMap должен иметь либо userMessageId, либо text:**
```sql
ALTER TABLE messages_map ADD CONSTRAINT message_has_content
  CHECK (user_message_id IS NOT NULL OR text IS NOT NULL);
```

### Cleanup Jobs

```typescript
// Очистка истекших токенов (запускать по cron каждый час)
async function cleanupExpiredTokens() {
  await webLinkTokenRepository.deleteExpired()
}

// Очистка неактивных web-сессий (> 30 дней без активности)
async function cleanupInactiveSessions() {
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  await userRepository.deleteInactiveWebUsers(threshold)
}
```

---

## Backward Compatibility

- Существующие Telegram-пользователи не затрагиваются
- `channel = TELEGRAM` по умолчанию для всех существующих сообщений
- Все существующие запросы продолжают работать
- Миграция безопасна для production
