# ============ BUILD STAGE ============
FROM node:24-alpine AS builder

WORKDIR /app

# Garante devDependencies (prisma CLI, vite, etc.) mesmo se a plataforma de
# build (ex.: Coolify) injetar NODE_ENV=production como build arg — o npm
# pula devDependencies nesse caso, mesmo sem --only=production explícito.
ENV NODE_ENV=development

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies (--include=dev reforça o ENV acima)
RUN npm install --legacy-peer-deps --include=dev
RUN cd backend && npm install --legacy-peer-deps --include=dev
RUN cd frontend && npm install --legacy-peer-deps --include=dev

# Copy source code
COPY . .

# Generate Prisma client
RUN cd backend && npm run prisma:generate

# Build frontend
RUN cd frontend && npm run build

# ============ RUNTIME STAGE ============
FROM node:24-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install only production dependencies
RUN npm install --legacy-peer-deps --only=production
RUN cd backend && npm install --legacy-peer-deps --only=production
RUN cd frontend && npm install --legacy-peer-deps --only=production

# Copy Prisma files
COPY backend/prisma ./backend/prisma

# Reaproveita o Prisma Client já gerado no builder (a instalação de produção
# acima só traz o pacote "cru", sem o client; e a CLI "prisma" não está
# disponível aqui por causa do --only=production, então não dá pra gerar de novo)
COPY --from=builder /app/backend/node_modules/.prisma ./backend/node_modules/.prisma
COPY --from=builder /app/backend/node_modules/@prisma/client ./backend/node_modules/@prisma/client

# Copy built frontend from builder
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy backend source
COPY backend ./backend

# Copy .env.example (será sobrescrito em runtime)
COPY backend/.env.example ./backend/.env

# Expose ports
EXPOSE 3001

# Health check (usa a mesma porta que o server.js resolve: PORT ou 3001)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run with dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/server.js"]
