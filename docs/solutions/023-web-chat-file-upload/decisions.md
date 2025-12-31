# Decisions: Загрузка файлов из веб-чата

## Контекст

Пользователи веб-чата должны иметь возможность отправлять файлы в поддержку: изображения, документы, архивы.

## Принятые решения (2025-12-31)

### 1. Хранение через Telegram
**Решение:** Файл загружается на сервер → отправляется в Telegram → file_id сохраняется в БД

**Альтернативы:**
- Локальное хранилище (S3/MinIO) — отклонено, требует дополнительной инфраструктуры
- Прямая загрузка в Telegram из браузера — невозможно из-за токена

**Причина:** Telegram уже хранит файлы, не нужна дополнительная инфраструктура

### 2. Без ClamAV
**Решение:** Антивирусная проверка отложена

**Причина:** Усложняет MVP, требует дополнительного сервиса в Docker

**TD:** Создать задачу на будущее

### 3. Без конвертации форматов
**Решение:** HEIC/BMP отправляются как есть

**Причина:** Telegram поддерживает эти форматы нативно

### 4. MVP scope
**Решение:** Без Drag&Drop и отмены загрузки

**Причина:** Базовый функционал важнее, UX улучшения позже

**TD:** TD-049 для Drag&Drop и отмены

## Что реализовано

- [x] Backend: POST /api/chat/upload endpoint
- [x] Backend: валидация MIME type (whitelist)
- [x] Backend: валидация размера файла
- [x] Backend: отправка в Telegram (sendPhoto/sendDocument)
- [x] Widget: AttachButton компонент
- [x] Widget: FilePreview компонент
- [x] Widget: UploadProgress компонент
- [x] Widget: интеграция в ChatInput
- [x] Тесты (26 тестов для file-validation)

## Что НЕ реализовано (Technical Debt)

- [ ] TD-049: Drag&Drop и отмена загрузки
- [ ] TD-050: Magic bytes validation
- [ ] TD-051: ClamAV интеграция

## Технические детали

### Разрешённые MIME types

**Изображения (max 10 MB):**
- image/jpeg, image/png, image/gif, image/webp
- image/heic, image/heif, image/bmp

**Документы (max 20 MB):**
- application/pdf
- application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
- application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- text/plain, text/csv
- application/rtf

**Архивы (max 20 MB):**
- application/zip
- application/x-rar-compressed
- application/x-7z-compressed

### Запрещённые типы
- EXE, MSI, BAT, CMD — исполняемые
- JS, VBS, PS1 — скрипты
- HTML, HTM, SVG — XSS риски
- PHP, PY, SH — серверные скрипты

### API
```
POST /api/chat/upload
Content-Type: multipart/form-data
Cookie: webchat_session=...

file: <binary>

Response 201:
{
  "success": true,
  "data": {
    "messageId": "msg-id",
    "type": "image" | "document",
    "fileName": "report.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "timestamp": "2025-12-31T12:00:00Z"
  }
}
```

### Rate Limiting
10 файлов в минуту на сессию
