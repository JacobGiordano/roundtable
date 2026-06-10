FROM node:20-alpine AS builder

WORKDIR /app

# Install native build tools for better-sqlite3 (requires node-gyp).
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ─── Runtime image ────────────────────────────────────────────────────────────

FROM node:20-alpine AS runtime

WORKDIR /app

# Install native build tools for better-sqlite3 native addon.
RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install --omit=dev

# Copy compiled output from builder stage.
COPY --from=builder /app/dist ./dist

# The SQLite database is stored in /app/data, which is mounted as a volume
# in docker-compose.yml so the file persists across container restarts.
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "dist/index.js"]
