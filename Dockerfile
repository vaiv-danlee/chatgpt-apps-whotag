# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy all package files including workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/
COPY web/package.json web/

# Install all dependencies using pnpm workspace (uses lock file from root)
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Build web (React component)
RUN cd web && pnpm run build

# Build server (TypeScript)
RUN cd server && pnpm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Copy node_modules from builder (ensures exact same versions)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules

# Copy built files from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/docs ./docs
COPY --from=builder /app/package.json ./package.json

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Start server
CMD ["node", "server/dist/index.js"]
