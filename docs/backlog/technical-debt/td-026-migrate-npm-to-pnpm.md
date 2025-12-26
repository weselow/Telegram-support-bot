# TD-026: Миграция с npm на pnpm

**Источник:** Улучшение инфраструктуры
**Приоритет:** Низкий
**Тип:** Инфраструктура

## Описание

Перейти с npm на pnpm для ускорения установки зависимостей и экономии дискового пространства.

## Проблема

npm:
- Медленная установка зависимостей
- Дублирование пакетов в node_modules
- Большой размер node_modules
- Phantom dependencies (доступ к неявным зависимостям)

## Преимущества pnpm

- **Скорость:** в 2-3 раза быстрее npm
- **Экономия места:** symlinks вместо копирования
- **Строгость:** нет phantom dependencies
- **Совместимость:** работает с существующим package.json
- **Workspace support:** лучше для монорепозиториев

## План миграции

### 1. Установка pnpm

```bash
npm install -g pnpm
```

### 2. Удаление node_modules и package-lock.json

```bash
rm -rf node_modules
rm package-lock.json
```

### 3. Установка зависимостей через pnpm

```bash
pnpm install
```

Создастся `pnpm-lock.yaml`.

### 4. Обновление скриптов

В `package.json` скрипты остаются без изменений — pnpm совместим.

### 5. Обновление CI (если есть)

```yaml
# GitHub Actions
- run: npm install -g pnpm
- run: pnpm install
- run: pnpm test
```

### 6. Обновление документации

В `README.md` и `CLAUDE.md`:
```bash
# До
npm install
npm run dev

# После
pnpm install
pnpm dev
```

### 7. Добавление .npmrc (опционально)

```ini
# .npmrc
shamefully-hoist=true  # если нужна совместимость с некоторыми пакетами
```

## Файлы для изменения

- `package-lock.json` → удалить
- `pnpm-lock.yaml` → создать (автоматически)
- `README.md` — обновить инструкции
- `CLAUDE.md` — обновить команды
- `.github/workflows/*.yml` — если есть CI
- `Dockerfile` — если используется

## Риски

- Некоторые пакеты могут требовать `shamefully-hoist`
- Нужно проверить совместимость с Prisma

## Оценка

- Сложность: Низкая
- Риск: Низкий

---

## Перед началом работы

Ознакомься со стандартом: [backlog-workflow-standard.md](../../standards/backlog-workflow-standard.md)
