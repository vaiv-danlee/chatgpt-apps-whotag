# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy all package files
COPY package.json pnpm-lock.yaml* ./
COPY server/package.json server/
COPY web/package.json web/

# Install all dependencies (root, server, web)
RUN pnpm install --frozen-lockfile || pnpm install
RUN cd server && pnpm install --frozen-lockfile || pnpm install
RUN cd web && pnpm install --frozen-lockfile || pnpm install

# Copy source files
COPY . .

# Build web (React component)
RUN cd web && pnpm run build

# Build server (TypeScript)
RUN cd server && pnpm run build

# Production stage
FROM node:20-slim AS production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY server/package.json server/

# Install production dependencies only
RUN cd server && pnpm install --prod --frozen-lockfile || pnpm install --prod

# Copy built files from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/web/dist ./web/dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Start server
CMD ["node", "server/dist/index.js"]
