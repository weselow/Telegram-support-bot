# Деплой Telegram Support Bot

## Обзор

Деплой происходит автоматически при push в `main`:

```
Push в main → Тесты → Build образа → Push в ghcr.io → SSH → Обновление app контейнера
```

PostgreSQL и Redis **не перезапускаются** при деплое — обновляется только app.

---

## 1. Настройка GitHub Secrets и Variables

### Repository Settings → Secrets and variables → Actions

#### Secrets (зашифрованные, не видны никому)

| Имя | Описание | Пример |
|-----|----------|--------|
| `PROD_HOST` | IP или домен prod сервера | `123.45.67.89` |
| `PROD_USER` | SSH пользователь | `deploy` |
| `SSH_PRIVATE_KEY` | Приватный SSH ключ | `-----BEGIN OPENSSH...` |
| `BOT_TOKEN` | Токен Telegram бота | `123456789:ABC...` |
| `SUPPORT_GROUP_ID` | ID супергруппы поддержки | `-1001234567890` |
| `DATABASE_PASSWORD` | Пароль PostgreSQL | `strong_password_here` |
| `DADATA_API_KEY` | API ключ DaData (опционально) | `abc123...` |
| `SENTRY_DSN` | DSN для Sentry (опционально) | `https://...@sentry.io/...` |

#### Variables (не зашифрованы, видны в public repo)

| Имя | Описание | Пример |
|-----|----------|--------|
| `DEPLOY_PATH` | Путь к проекту на сервере | `/opt/support-bot` |
| `BOT_USERNAME` | Username бота (без @) | `my_support_bot` |
| `SUPPORT_DOMAIN` | Домен для Caddy (HTTPS) | `support.example.com` |

---

## 2. Настройка Production сервера

### 2.1 Требования

- Ubuntu 22.04+ / Debian 12+
- Docker + Docker Compose
- Минимум 2 GB RAM, 20 GB SSD

### 2.2 Создание пользователя для деплоя

```bash
# На сервере от root
adduser deploy
usermod -aG docker deploy

# Создать директорию проекта
mkdir -p /opt/support-bot
chown deploy:deploy /opt/support-bot
```

### 2.3 Настройка SSH ключа

```bash
# На ЛОКАЛЬНОЙ машине — сгенерировать ключ
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/github_deploy

# Скопировать ПУБЛИЧНЫЙ ключ на сервер
ssh-copy-id -i ~/.ssh/github_deploy.pub deploy@YOUR_SERVER_IP

# Скопировать ПРИВАТНЫЙ ключ в GitHub Secret SSH_PRIVATE_KEY
cat ~/.ssh/github_deploy
```

### 2.4 Первоначальный запуск

```bash
cd /opt/support-bot

# Скачать docker-compose.yml
curl -O https://raw.githubusercontent.com/weselow/Telegram-support-bot/main/docker-compose.yml

# Создать директории для данных
mkdir -p .volumes/postgres .volumes/redis

# Всё! При первом деплое через GitHub Actions:
# - Создастся .env из secrets
# - Запустятся postgres, redis, app
```

---

## 3. Как работает деплой

### Автоматический (при push в main)

1. GitHub Actions запускает тесты
2. Собирает Docker образ
3. Пушит в `ghcr.io/weselow/telegram-support-bot:latest`
4. Предыдущий `latest` переименовывается в `previous`
5. SSH на сервер:
   - Обновляет `.env` из secrets
   - `docker compose pull app`
   - `docker compose up -d app` (запустит postgres/redis если не запущены)

### Ручной запуск

GitHub → Actions → Deploy → Run workflow

---

## 4. Откат на предыдущую версию

```bash
# На сервере
cd /opt/support-bot

# Изменить тег в docker-compose.yml
sed -i 's/:latest/:previous/' docker-compose.yml

# Применить
docker compose pull app
docker compose up -d --no-deps app

# Вернуть обратно
sed -i 's/:previous/:latest/' docker-compose.yml
```

Или через GitHub: откатить коммит и push.

---

## 5. Мониторинг

### Логи

```bash
# Все сервисы
docker compose logs -f

# Только app
docker compose logs -f app

# Последние 100 строк
docker compose logs --tail=100 app
```

### Статус

```bash
docker compose ps
```

### Ресурсы

```bash
docker stats
```

---

## 6. Troubleshooting

### Контейнер не запускается

```bash
# Проверить логи
docker compose logs app

# Проверить .env
cat .env

# Проверить подключение к БД
docker compose exec postgres psql -U postgres -c "SELECT 1"
```

### SSH не работает

```bash
# Проверить подключение локально
ssh -i ~/.ssh/github_deploy deploy@SERVER_IP

# Проверить права на ключ
chmod 600 ~/.ssh/github_deploy
```

---

## 7. Структура на сервере

```
/opt/support-bot/
├── docker-compose.yml      # Только этот файл (без override!)
├── Caddyfile               # Конфиг reverse proxy (создаётся при деплое)
├── .env                    # Создаётся автоматически при деплое
└── .volumes/
    ├── postgres/           # Данные PostgreSQL
    ├── redis/              # Данные Redis
    └── caddy/              # SSL сертификаты и конфиг Caddy
        ├── data/
        └── config/
```

**Важно:** `docker-compose.override.yml` — только для development!
На production его НЕ должно быть.

---

## 8. Caddy (HTTPS)

Caddy автоматически получает SSL сертификаты от Let's Encrypt.

**Требования:**
- Домен должен указывать на IP сервера (A-запись)
- Порты 80 и 443 должны быть открыты

**Проверка:**
```bash
# Логи Caddy
docker compose logs caddy

# Статус сертификата
curl -I https://your-domain.com
```
