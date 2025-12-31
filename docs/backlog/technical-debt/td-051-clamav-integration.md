# TD-051: ClamAV интеграция для проверки файлов

**Статус:** TODO
**Приоритет:** Низкий
**Источник:** Task 023 (Web Chat File Upload)

## Проблема

Загружаемые файлы не проверяются на вирусы. Потенциально вредоносные файлы могут быть отправлены в Telegram.

## Решение

Интеграция с ClamAV через Docker контейнер.

## Требования

### Docker
```yaml
services:
  clamav:
    image: clamav/clamav:latest
    ports:
      - "3310:3310"
    volumes:
      - clamav-data:/var/lib/clamav
```

### Backend
- Подключение к ClamAV через TCP (порт 3310)
- Проверка файла перед отправкой в Telegram
- Отклонение заражённых файлов с понятным сообщением

## Изменяемые файлы

- `docker-compose.yml` - ClamAV сервис
- `src/services/clamav.service.ts` - новый сервис
- `src/http/routes/chat.ts` - вызов проверки

## Библиотеки

- `clamscan` или `clamav.js` npm пакет

## Оценка

~4-6 часов работы (с тестированием)

## Примечание

Требует дополнительных ресурсов сервера (~1GB RAM для ClamAV).
