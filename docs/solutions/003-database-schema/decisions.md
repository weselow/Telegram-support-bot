# Решения по Task 003: Prisma-схема и миграции

## Выбор типов данных

### User (основная таблица пользователей/тикетов)
| Поле | Тип | Обоснование |
|------|-----|-------------|
| id | UUID | Стандарт для PK, безопасность |
| tg_user_id | BigInt | Telegram user ID может быть > 2^31 |
| tg_username | String? | Опционален в Telegram |
| tg_first_name | String | Всегда присутствует |
| topic_id | Int | ID топика в супергруппе |
| status | Enum | Фиксированный набор статусов |
| phone | String? | Опционален, запрашивается позже |
| source_url | String? | URL страницы откуда пришёл |
| created_at | DateTime | Время создания |
| updated_at | DateTime | Автообновление |

### TicketEvent (история событий)
| Поле | Тип | Обоснование |
|------|-----|-------------|
| id | UUID | PK |
| user_id | UUID | FK на User |
| event_type | Enum | Тип события |
| old_value | String? | Для status_changed |
| new_value | String? | Для status_changed |
| question | String? | Текст обращения для opened/reopened |
| source_url | String? | URL для opened/reopened |
| created_at | DateTime | Время события |

### MessageMap (связь сообщений DM ↔ топик)
| Поле | Тип | Обоснование |
|------|-----|-------------|
| id | UUID | PK |
| user_id | UUID | FK на User |
| dm_message_id | Int | ID сообщения в DM |
| topic_message_id | Int | ID сообщения в топике |
| direction | Enum | Направление пересылки |
| created_at | DateTime | Время |

## Индексы

- `User.tg_user_id` — UNIQUE, поиск по Telegram ID
- `User.topic_id` — UNIQUE, поиск по топику
- `TicketEvent.user_id` — FK index для истории
- `MessageMap.user_id + dm_message_id` — поиск связанного сообщения
- `MessageMap.user_id + topic_message_id` — обратный поиск

## Prisma 7.x особенности

- Rust-free client (чистый JS)
- Улучшенная производительность
- Поддержка ESM из коробки
