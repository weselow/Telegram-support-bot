# 023: Загрузка файлов из веб-чата

**Статус:** IN PROGRESS
**Приоритет:** Средний
**Оценка:** 6-8 часов

## Описание

Пользователь веб-чата должен иметь возможность отправлять файлы в чат поддержки: изображения, документы, архивы.

## Принятые решения (2025-12-31)

1. **Хранение через Telegram** — файл загружается на сервер → отправляется в Telegram → file_id сохраняется в БД
2. **Без ClamAV** — антивирусная проверка отложена
3. **Без конвертации форматов** — HEIC/BMP отправляются как есть (Telegram поддерживает)
4. **MVP scope** — без Drag&Drop и отмены загрузки (вынесено в TD)

## Разрешённые типы файлов

### Изображения
| Формат | MIME | Разрешён |
|--------|------|----------|
| JPG/JPEG | image/jpeg | ✅ |
| PNG | image/png | ✅ |
| GIF | image/gif | ✅ |
| WebP | image/webp | ✅ |
| HEIC/HEIF | image/heic, image/heif | ✅ |
| BMP | image/bmp | ✅ |

### Документы
| Формат | MIME | Разрешён |
|--------|------|----------|
| PDF | application/pdf | ✅ |
| DOC | application/msword | ✅ |
| DOCX | application/vnd.openxmlformats-officedocument.wordprocessingml.document | ✅ |
| XLS | application/vnd.ms-excel | ✅ |
| XLSX | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | ✅ |
| TXT | text/plain | ✅ |
| CSV | text/csv | ✅ |
| RTF | application/rtf | ✅ |

### Архивы
| Формат | MIME | Разрешён |
|--------|------|----------|
| ZIP | application/zip | ✅ |
| RAR | application/x-rar-compressed | ✅ |
| 7Z | application/x-7z-compressed | ✅ |

### Запрещённые типы (безопасность)
- EXE, MSI, BAT, CMD — исполняемые
- JS, VBS, PS1 — скрипты
- HTML, HTM, SVG — XSS риски
- PHP, PY, SH — серверные скрипты

## Ограничения размера

| Тип | Лимит |
|-----|-------|
| Изображения | 10 MB |
| Документы/Архивы | 20 MB |

## Требования MVP

### Функциональные
- [x] Кнопка прикрепления файла в ChatInput
- [ ] Валидация типа файла (whitelist)
- [ ] Валидация размера с понятным сообщением
- [ ] Превью изображения перед отправкой
- [ ] Иконка типа файла для документов
- [ ] Прогресс-бар загрузки

### Отложено (Technical Debt)
- [ ] Drag & Drop файлов → TD-049
- [ ] Отмена загрузки → TD-049
- [ ] Magic bytes проверка → TD-050
- [ ] Антивирусная проверка (ClamAV) → TD-051

### Технические
- [ ] API endpoint `POST /api/chat/upload` (multipart/form-data)
- [ ] Валидация MIME type на сервере
- [ ] Отправка в Telegram: `sendPhoto`, `sendDocument`
- [ ] WebSocket уведомление о новом медиа

## API

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

Errors:
- 400 INVALID_FILE_TYPE: Этот тип файла не поддерживается
- 400 FILE_TOO_LARGE: Файл слишком большой. Максимум: 20 МБ
- 401 SESSION_NOT_FOUND: Сессия не найдена
- 429 RATE_LIMITED: Слишком много запросов
```

## UI компоненты

1. **AttachButton** — кнопка-скрепка рядом с полем ввода
2. **FilePreview** — превью перед отправкой (изображение или иконка + имя файла)
3. **UploadProgress** — индикатор загрузки (процент или спиннер)

## Безопасность

1. **Whitelist MIME types** — только разрешённые типы
2. **Ограничение размера** — 20 MB максимум
3. **Sanitize имени файла** — удаление опасных символов
4. **Rate limiting** — 10 файлов в минуту

## Чеклист перед завершением

- [ ] Все требования MVP выполнены
- [ ] Тесты написаны и проходят
- [ ] `/check-code` запущен
- [ ] `pnpm run lint && pnpm run typecheck && pnpm test` проходят
- [ ] Документация обновлена
- [ ] TD задачи созданы для отложенного функционала
