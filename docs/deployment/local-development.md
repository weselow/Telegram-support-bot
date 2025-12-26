# Локальная разработка

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone https://github.com/your-username/telegram-support-bot.git
cd telegram-support-bot
```

### 2. Создать файл окружения

```bash
cp .env.example .env.local
```

Отредактировать `.env.local`:
```env
BOT_TOKEN=ваш_токен_от_botfather
SUPPORT_GROUP_ID=-100xxxxxxxxxx
```

См. [telegram-setup.md](./telegram-setup.md) для получения этих значений.

### 3. Запустить сервисы

```bash
docker compose up -d
```

Это запустит:
- PostgreSQL на порту `5433`
- Redis на порту `6380`
- Бот в режиме разработки
- **Миграции БД применятся автоматически**

### 4. Проверить работу

Отправьте `/start` боту в Telegram.

Логи:
```bash
docker compose logs -f app
```

---

## Режимы запуска

### Полный стек в Docker (рекомендуется для старта)

Всё в контейнерах — бот, БД, Redis:

```bash
docker compose up -d
```

> `docker-compose.override.yml` подхватывается автоматически

### Только инфраструктура (для активной разработки)

БД и Redis в Docker, бот на хосте с hot-reload:

```bash
# 1. Запустить только БД и Redis
docker compose up -d postgres redis

# 2. На хосте (в терминале проекта)
npm install
npm run db:migrate   # первый раз или после новых миграций
npm run dev          # бот с hot-reload
```

Преимущество: изменения в коде применяются мгновенно без пересборки Docker.

### Production режим

Без dev-оверрайдов:

```bash
docker compose -f docker-compose.yml up -d
```

---

## Файлы окружения

| Файл | Назначение | Git |
|------|------------|-----|
| `.env.example` | Шаблон с примерами | ✅ В репозитории |
| `.env` | Production конфиг | ❌ Игнорируется |
| `.env.local` | Локальная разработка | ❌ Игнорируется |
| `.env.*.local` | Другие локальные | ❌ Игнорируются |

Приоритет загрузки: `.env.local` > `.env`

---

## Порты

Используются нестандартные порты, чтобы избежать конфликтов:

| Сервис | Стандартный | В проекте |
|--------|-------------|-----------|
| PostgreSQL | 5432 | **5433** |
| Redis | 6379 | **6380** |

Если порты заняты, измените в `docker-compose.yml`:
```yaml
ports:
  - "5434:5432"  # другой порт хоста
```

И обновите `.env.local`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/support_bot
```

---

## Полезные команды

```bash
# Логи бота
docker compose logs -f app

# Логи всех сервисов
docker compose logs -f

# Перезапуск бота
docker compose restart app

# Остановить всё
docker compose down

# Остановить и удалить данные
docker compose down
rm -rf .volumes

# Пересобрать образ
docker compose build --no-cache app
```

---

## Данные

Данные PostgreSQL и Redis хранятся локально в папке `.volumes/`:

```
.volumes/
├── postgres/    # данные БД
└── redis/       # данные Redis
```

Папка добавлена в `.gitignore`.

---

## База данных

```bash
# Применить миграции
npm run db:migrate

# Открыть Prisma Studio (GUI)
npm run db:studio

# Сгенерировать клиент после изменения schema.prisma
npm run db:generate

# Сбросить БД (удалит все данные!)
npx prisma migrate reset
```

---

## Troubleshooting

### Port already in use

```
Error: listen EADDRINUSE: address already in use :::5433
```

Порт занят другим процессом. Варианты:
1. Остановить процесс: `netstat -ano | findstr :5433` → `taskkill /PID <pid> /F`
2. Изменить порт в `docker-compose.yml`

### Cannot connect to database

1. Проверьте что контейнер запущен: `docker compose ps`
2. Проверьте логи: `docker compose logs postgres`
3. Проверьте `DATABASE_URL` в `.env.local`

### Bot not responding

1. Проверьте `BOT_TOKEN` — без пробелов и переносов строк
2. Проверьте логи: `docker compose logs app`
3. Убедитесь что бот не запущен где-то ещё (один токен = один инстанс)
