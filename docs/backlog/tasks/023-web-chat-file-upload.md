# 023: Загрузка файлов из веб-чата

**Статус:** TODO
**Приоритет:** Средний
**Оценка:** 6-8 часов

## Описание

Пользователь веб-чата должен иметь возможность отправлять файлы в чат поддержки: изображения, документы, архивы.

## Разрешённые типы файлов

### Изображения
| Формат | MIME | Разрешён | Примечание |
|--------|------|----------|------------|
| JPG/JPEG | image/jpeg | ✅ | Основной формат фото |
| PNG | image/png | ✅ | Скриншоты, графика |
| GIF | image/gif | ✅ | Анимации |
| WebP | image/webp | ✅ | Современный формат |
| HEIC/HEIF | image/heic, image/heif | ✅ | Фото с iPhone (конвертировать в JPEG) |
| BMP | image/bmp | ⚠️ | Конвертировать в PNG |
| SVG | image/svg+xml | ❌ | XSS риски |
| TIFF | image/tiff | ❌ | Слишком большие |

### Документы
| Формат | MIME | Разрешён | Примечание |
|--------|------|----------|------------|
| PDF | application/pdf | ✅ | Основной документ |
| DOC | application/msword | ✅ | Word старый |
| DOCX | application/vnd.openxmlformats-officedocument.wordprocessingml.document | ✅ | Word новый |
| XLS | application/vnd.ms-excel | ✅ | Excel старый |
| XLSX | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | ✅ | Excel новый |
| TXT | text/plain | ✅ | Текстовые файлы |
| CSV | text/csv | ✅ | Таблицы данных |
| RTF | application/rtf | ✅ | Rich Text |

### Архивы
| Формат | MIME | Разрешён | Примечание |
|--------|------|----------|------------|
| ZIP | application/zip | ✅ | Основной архив |
| RAR | application/x-rar-compressed | ✅ | Популярный архив |
| 7Z | application/x-7z-compressed | ⚠️ | По запросу |

### Запрещённые типы (безопасность)
| Формат | Причина |
|--------|---------|
| EXE, MSI, BAT, CMD | Исполняемые файлы |
| JS, VBS, PS1 | Скрипты |
| HTML, HTM | XSS риски |
| PHP, PY, SH | Серверные скрипты |
| DLL, SYS | Системные файлы |

## Ограничения размера

| Тип | Лимит | Обоснование |
|-----|-------|-------------|
| Изображения | 10 MB | Telegram Bot API лимит |
| Документы | 20 MB | Telegram Bot API лимит для документов |
| Архивы | 20 MB | Аналогично документам |
| **Общий лимит** | **20 MB** | Ограничение Telegram |

## Требования

### Функциональные
- [ ] Кнопка прикрепления файла в ChatInput
- [ ] Drag & Drop файлов в область чата
- [ ] Валидация типа файла (whitelist)
- [ ] Валидация размера с понятным сообщением
- [ ] Превью изображения перед отправкой
- [ ] Иконка типа файла для документов
- [ ] Прогресс-бар загрузки
- [ ] Отмена загрузки

### Технические
- [ ] API endpoint `POST /api/chat/upload` (multipart/form-data)
- [ ] Валидация MIME type на сервере (не доверять расширению)
- [ ] Антивирусная проверка (опционально, ClamAV)
- [ ] Отправка в Telegram: `sendPhoto`, `sendDocument`
- [ ] Сохранение `mediaFileId` в БД для отображения в истории
- [ ] WebSocket уведомление о новом медиа

## API

```
POST /api/chat/upload
Content-Type: multipart/form-data

file: <binary>

Response:
{
  "success": true,
  "data": {
    "id": "msg-id",
    "type": "image" | "document",
    "fileName": "report.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf",
    "mediaUrl": "/api/media/...",
    "createdAt": "2025-12-30T12:00:00Z"
  }
}

Errors:
- 400: Invalid file type
- 413: File too large (>20MB)
- 415: Unsupported media type
```

## UI компоненты

1. **AttachButton** — кнопка прикрепления (иконка скрепки)
2. **FilePreview** — превью перед отправкой с кнопками отмена/отправить
3. **UploadProgress** — индикатор загрузки с возможностью отмены
4. **FileMessage** — отображение файла в списке сообщений

## Сообщения об ошибках

```typescript
const ERROR_MESSAGES = {
  FILE_TOO_LARGE: 'Файл слишком большой. Максимум: 20 МБ',
  INVALID_TYPE: 'Этот тип файла не поддерживается',
  UPLOAD_FAILED: 'Не удалось загрузить файл. Попробуйте ещё раз',
}
```

## Безопасность

1. **Whitelist MIME types** — только разрешённые типы
2. **Magic bytes проверка** — не доверять расширению файла
3. **Ограничение имени файла** — sanitize, макс 255 символов
4. **Изоляция хранения** — файлы вне webroot
5. **Rate limiting** — макс 10 файлов в минуту

## Связанные задачи

- [007](../solutions/007-mirror-topic-to-user/007-mirror-topic-to-user.md) — Зеркалирование медиа из топика уже работает
