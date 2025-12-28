#!/bin/sh
set -e

echo "Running database migrations..."
DATABASE_URL="${DATABASE_URL}" ./node_modules/.bin/prisma migrate deploy --schema=prisma/schema.prisma

echo "Starting application..."
exec node dist/index.js
