# Git Workflow Standard

## Ветки

**Naming**: `feature/[number]-[task-name]` | `fix/[number]-[description]`

**Примеры:**
- `feature/013-sla-timers`
- `fix/015-phone-validation`

**Правила:**
- Одна задача = одна ветка, работаем до завершения
- Переключение на другую ветку — только с разрешения пользователя

## Документация решений

**Путь**: `docs/solutions/[number]-[task-name]/decisions.md`

Записывать:
- Архитектурные решения
- Trade-offs и альтернативы
- Формат данных, API

## Перед коммитом — ПРОВЕРИТЬ

1. Тесты проходят: `npm test`
2. TypeScript компилируется: `npm run typecheck`
3. ESLint чист: `npm run lint`
4. Если что-то не реализовано — сообщить пользователю

## Перед мержем/удалением ветки — ПРОВЕРИТЬ

### 1. Нет незакоммиченных файлов
```bash
git status
# Должно быть: nothing to commit, working tree clean
```

### 2. Все задачи из файла задачи выполнены
- Открыть файл задачи (`docs/backlog/tasks/[number]-[name].md`)
- Убедиться что все подзадачи отмечены `[x]`
- Статус изменён на `DONE`

### 3. Файл задачи перемещён правильно
```
docs/backlog/tasks/013-sla-timers.md
         ↓
docs/solutions/013-sla-timers/013-sla-timers.md
```

**ВАЖНО:** Файл сохраняет оригинальное имя! НЕ переименовывать в `task.md` или другое.

### 4. Backlog README обновлён
- Ссылка на задачу указывает на `docs/solutions/...`
- Статус изменён на `DONE`

### 5. Пользователь подтвердил мерж/удаление
