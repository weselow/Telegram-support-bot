# =============================================================================
# Widget builder stage
# =============================================================================
FROM node:22-alpine AS widget-builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /widget

# Copy package files and install
COPY chat-widget/package.json chat-widget/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY chat-widget/ ./
RUN pnpm build:prod

# =============================================================================
# App builder stage
# =============================================================================
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

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

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install production deps only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma schema, config, and generated client from builder
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/dist/generated ./dist/generated

# Copy Prisma CLI for migrations (prisma is devDependency, need to copy from builder)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Copy built files and config from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Copy widget static files
COPY --from=widget-builder /widget/dist ./public/chat-widget

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
