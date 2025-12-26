# Build stage (keeps dev dependencies for development)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy Prisma schema and config, generate client
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

# Copy source code, config, and build
COPY tsconfig.json ./
COPY src ./src
COPY config ./config
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy Prisma and generate client
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

# Copy built files and config from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config ./config

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production

ENTRYPOINT ["./docker-entrypoint.sh"]
