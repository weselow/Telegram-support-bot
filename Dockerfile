# =============================================================================
# Widget builder stage
# =============================================================================
FROM node:22-alpine AS widget-builder

# pnpm version comes from the "packageManager" field in chat-widget/package.json.
# It is pinned there on purpose: pnpm 11 dropped the "pnpm" field in package.json,
# so onlyBuiltDependencies was ignored and esbuild's install script never ran
# (ERR_PNPM_IGNORED_BUILDS).
RUN corepack enable

WORKDIR /widget

# Copy package files and install with cache
COPY chat-widget/package.json chat-widget/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-widget,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source and build
COPY chat-widget/ ./
RUN pnpm build:prod

# =============================================================================
# App builder stage
# =============================================================================
FROM node:22-alpine AS builder

# pnpm version comes from the "packageManager" field in package.json
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev) with cache
RUN --mount=type=cache,id=pnpm-app,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy Prisma schema and config, generate client
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm exec prisma generate

# Copy source code, config, and build
COPY tsconfig.json ./
COPY src ./src
COPY config ./config
RUN pnpm run build

# Production stage
FROM node:22-alpine AS production

# pnpm version comes from the "packageManager" field in package.json
RUN corepack enable

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install production deps only with cache.
#
# Лишнее удаляется в том же слое, что и установка: отдельная команда RUN не
# уменьшила бы образ — файлы остались бы в предыдущем слое, а сверху лёг бы
# только признак удаления.
#   - typescript приезжает как необязательная сопутствующая зависимость
#     @prisma/client (он есть в devDependencies, поэтому pnpm тянет его и в
#     установку --prod) и во время работы не нужен — 22 МБ;
#   - @prisma/client везёт компиляторы запросов для пяти СУБД, нам нужен
#     только PostgreSQL — 19 МБ.
#
# Сам Prisma CLI (нужен для migrate deploy при старте) pnpm уже кладёт в
# хранилище как сопутствующую зависимость @prisma/client, но ссылку для запуска
# не создаёт — заводим её сами вместо копирования каталога из этапа сборки.
# Проверка test -x нужна, чтобы поломка вскрылась при сборке, а не при старте
# контейнера на боевом сервере.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-app,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod && \
    rm -rf node_modules/.pnpm/typescript@* node_modules/.pnpm/node_modules/typescript && \
    find -L node_modules/@prisma/client/runtime -name 'query_compiler_bg.*' \
      ! -name '*postgresql*' -delete && \
    ln -s .pnpm/node_modules/prisma node_modules/prisma && \
    test -x node_modules/prisma/build/index.js

# Copy Prisma schema, config, and generated client from builder
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/dist/generated ./dist/generated

# Copy built files and config from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Copy widget static files
COPY --from=widget-builder /widget/dist ./public/chat-widget

# Copy entrypoint script
COPY --chmod=755 docker-entrypoint.sh ./

# Файлы остаются за root и доступны на чтение всем — приложение ничего не пишет
# в /app. Прежняя команда `chown -R nodejs:nodejs /app` создавала в новом слое
# полную копию каталога (~340 МБ) и, что важнее, пересобиралась при каждой
# выкатке, поэтому соседние версии образа не делили ни одного тяжёлого слоя.
USER nodejs

ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
