# Задача 001: Инициализация проекта

**Этап:** 1 - Фундамент
**Статус:** TODO
**Приоритет:** Высокий

## Описание

Создать базовую структуру проекта с настройкой TypeScript, ESLint, и зависимостей.

## Подзадачи

- [ ] Инициализация package.json
- [ ] Настройка TypeScript (tsconfig.json)
- [ ] Настройка ESLint + Prettier
- [ ] Установка основных зависимостей (grammy, prisma, bullmq, pino)
- [ ] Создание структуры папок (src/, config/, tests/)
- [ ] Создание .env.example
- [ ] Настройка scripts в package.json (dev, build, start, test, lint)

## Зависимости

Нет (первая задача)

## Результат

- Проект запускается командой `npm run dev`
- TypeScript компилируется без ошибок
- Линтер проходит без ошибок

---

## Начало работы

### 1. Создай ветку

```bash
git checkout -b feature/001-project-init
```

### 2. Создай папку для решений

```bash
mkdir -p docs/solutions/001-project-init
```

### 3. Веди историю решений

В файле `docs/solutions/001-project-init/decisions.md` записывай:
- Какие библиотеки выбраны и почему
- Какие проблемы возникли и как решены
- Альтернативы, которые рассматривались

### 4. По завершении

```bash
git add .
git commit -m "feat(001): инициализация проекта"
git checkout main
git merge feature/001-project-init
```
