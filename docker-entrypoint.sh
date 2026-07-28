#!/bin/sh
set -e

echo "Running database migrations..."
# Запускаем CLI напрямую: в образе стоят только рабочие зависимости, и обёртки
# node_modules/.bin/prisma там нет — ссылку на пакет создаёт Dockerfile.
DATABASE_URL="${DATABASE_URL}" node node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma

echo "Starting application..."
exec node dist/index.js
