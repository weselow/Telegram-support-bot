# Решения по TD-026: Миграция npm → pnpm

## Решение 1: Настройка pnpm для Prisma

**Проблема:** При установке через pnpm игнорировались build-скрипты Prisma.

**Решение:** Добавлена секция `pnpm.onlyBuiltDependencies` в package.json:

```json
"pnpm": {
  "onlyBuiltDependencies": [
    "prisma",
    "@prisma/engines",
    "esbuild"
  ]
}
```

**Обоснование:** pnpm по умолчанию не выполняет postinstall скрипты для зависимостей. Prisma требует генерации бинарников при установке.

## Решение 2: Использование corepack в Docker

**Проблема:** Нужно установить pnpm в Docker-образе.

**Решение:** Использовать встроенный corepack вместо npm install -g pnpm:

```dockerfile
RUN corepack enable && corepack prepare pnpm@latest --activate
```

**Обоснование:**
- corepack — стандартный инструмент Node.js для управления пакетными менеджерами
- Не требует отдельной установки
- Гарантирует совместимость версий

## Решение 3: pnpm exec вместо npx

**Проблема:** Замена npx в скриптах.

**Решение:** Использовать `pnpm exec` для запуска бинарников из node_modules:

```bash
# Было
npx prisma migrate deploy

# Стало
pnpm exec prisma migrate deploy
```

**Обоснование:** `pnpm exec` — прямой аналог npx для pnpm.
