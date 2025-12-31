# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## PERSISTENT_RULES:

At start read ALL project standards files. This is MANDATORY:

**Core Standards (READ ALWAYS):**
- @docs/standards/GLOBAL-implementation-standard.md
- @docs/standards/testing-standards.md
- @docs/standards/tdd-standard.md
- @docs/standards/git-workflow-standard.md

**Backlog Tasks (ОБЯЗАТЕЛЬНО перед началом работы над задачей):**
- Перед началом работы над любой задачей из `docs/backlog/` — вызвать навык `start-task` или прочитать @docs/standards/backlog-workflow-standard.md
- Следовать чеклисту из стандарта

CRITICAL: After EVERY summarize or compacting conversation, you MUST:
1. Show message " == SUMMARIZE IS COMPLETED =="
2. Reload ALL standards files listed above
3. Focus on development rules, standards, dependency management, and code changes during compact




## Project Overview

Telegram-бот техподдержки для сайта. Пользователь общается с ботом в личных сообщениях, для каждого обращения создаётся топик в супергруппе поддержки. Бот зеркалит переписку между пользователем и сотрудниками.

**Технологии:** Node.js/TypeScript, PostgreSQL, Telegram Bot API

## Commands

```bash
# Запуск тестов (Vitest)
pnpm test                                    # Все тесты
pnpm test src/config                         # Тесты по пути
pnpm run test:watch                          # Watch mode
pnpm run test:coverage                       # С покрытием (>60%)

# Проверки
pnpm run typecheck                           # TypeScript компиляция
pnpm run lint                                # Линтинг
```

## Architecture

### Основные компоненты
- **Bot** — обработка сообщений пользователей в DM
- **Topic Manager** — создание/управление топиками в супергруппе
- **Message Mirror** — двунаправленная пересылка сообщений
- **SLA Engine** — напоминания и эскалация (10мин → 30мин → 2ч)
- **Ticket System** — управление статусами (Новый → В работе → Ждём клиента → Закрыт)

### Database Tables
- `tickets` — тикеты с привязкой к пользователю и топику
- `messages_map` — маппинг сообщений DM ↔ топик для reply
- `support_users` — зарегистрированные сотрудники поддержки

### Ключевые механики
- Payload при входе: base64url(url) + timestamp + HMAC подпись (TTL 24ч)
- Внутренние сообщения (`//` или `#internal`) не пересылаются пользователю
- Reply в топике → reply в DM на соответствующее сообщение

## Development Standards

### TDD Cycle (обязательно)
1. **RED** — тест первым, должен упасть
2. **GREEN** — минимальный код для прохождения
3. **REFACTOR** — улучшение при зелёных тестах

**Критично:** никогда не изменять тесты для устранения ошибок компиляции — изменять код под требования теста.

### Code Quality Metrics
- Cyclomatic Complexity < 10
- Function < 30 строк
- Class < 200 строк
- Parameters < 5
- Nesting < 4 уровней

### Перед завершением задачи
```bash
pnpm run lint && pnpm run typecheck && pnpm test && pnpm run test:coverage
```

## Special Rules

- Качество важнее скорости реализации
- При неуверенности — спрашивать с озвучиванием рекомендаций
- Правило 3-х альтернатив: придумать 3 решения, выбрать простейшее

## Chat Widget

**Версия:** При каждом пуше в `origin/main`, если были изменения в `chat-widget/`, увеличить `WIDGET_VERSION` в `chat-widget/src/widget.ts`

```typescript
// chat-widget/src/widget.ts
export const WIDGET_VERSION = '0.1.x'  // Инкрементировать patch-версию
```
