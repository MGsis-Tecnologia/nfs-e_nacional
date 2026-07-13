# ============ BUILD STAGE ============
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install --legacy-peer-deps
RUN cd backend && npm install --legacy-peer-deps
RUN cd frontend && npm install --legacy-peer-deps

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

# Copy built frontend from builder
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy backend source
COPY backend ./backend

# Copy .env.example (será sobrescrito em runtime)
COPY backend/.env.example ./backend/.env

# Expose ports
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run with dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/server.js"]
