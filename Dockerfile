# syntax=docker/dockerfile:1.6
# ============================================================================
# Find And Study — multi-stage production image
# ============================================================================

# ---- Stage 1: install + build ----------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Build için gerekli sistem araçları (canvas, sharp vb. native modüller için)
RUN apk add --no-cache python3 make g++ libc6-compat

# Önce sadece manifest dosyalarını kopyala — Docker katman önbelleğini iyileştirir
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --include=dev

# Geri kalan kaynak kodu
COPY . .

# Üretim için build (Vite + esbuild)
RUN npm run build \
 && npm prune --omit=dev


# ---- Stage 2: küçük çalışma imajı ------------------------------------------
FROM node:20-alpine AS runner

ENV NODE_ENV=production \
    PORT=5000

WORKDIR /app

# Root olmayan kullanıcı oluştur — güvenlik için
RUN addgroup -S app && adduser -S app -G app

# Sadece gerekli artefaktları al
COPY --from=builder --chown=app:app /app/dist ./dist
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./package.json
COPY --from=builder --chown=app:app /app/shared ./shared
COPY --from=builder --chown=app:app /app/migrations ./migrations
COPY --from=builder --chown=app:app /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=app:app /app/scripts ./scripts

# Kalıcı dosyalar için klasör (volume olarak bağlanır)
RUN mkdir -p /app/public/uploads/profiles \
             /app/public/uploads/logos \
             /app/public/uploads/content \
             /app/public/uploads/knowledge \
 && chown -R app:app /app/public

USER app

EXPOSE 5000

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health 2>/dev/null || exit 1

CMD ["node", "dist/index.js"]
