#!/usr/bin/env bash
# ============================================================================
# Find And Study — Tek-komutla yeni release dağıtım betiği
# ============================================================================
# Kullanım (Hostinger VPS'te, deploy kullanıcısı olarak):
#   cd /var/www/findandstudy && bash scripts/deploy.sh
#
# Yaptıkları:
#   1) git pull
#   2) npm ci (kilit dosyasına göre temiz kurulum)
#   3) npm run build
#   4) (varsa) drizzle migration / db push
#   5) pm2 reload — sıfır kesinti yeniden yükleme
# ============================================================================

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/findandstudy}"
PM2_NAME="${PM2_NAME:-findandstudy}"

# Renkler
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}==> $*${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }

cd "$APP_DIR"

START=$(date +%s)
log "Yeni release başlatılıyor — $(date '+%Y-%m-%d %H:%M:%S')"

# 1) Git pull
log "Kod güncelleniyor"
git fetch --prune
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git pull --ff-only origin "$CURRENT_BRANCH"

# 2) Bağımlılıklar
log "Bağımlılıklar (npm ci)"
npm ci --no-audit --no-fund

# 3) Build
log "Build (vite + esbuild)"
npm run build

# 4) DB şeması (varsa)
if [[ -d migrations ]] && [[ -n "$(ls -A migrations 2>/dev/null)" ]]; then
  log "Drizzle migrate"
  npx drizzle-kit migrate || warn "Migration başarısız — manuel müdahale gerekebilir"
else
  log "DB push (geliştirme şeması)"
  npm run db:push || warn "db:push başarısız — manuel kontrol"
fi

# 5) PM2 reload
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  log "PM2 reload (sıfır kesinti)"
  pm2 reload "$PM2_NAME" --update-env
else
  log "PM2 ilk kez başlatılıyor"
  pm2 start ecosystem.config.cjs --env production
fi
pm2 save

ELAPSED=$(($(date +%s) - START))
ok "Deploy tamam — ${ELAPSED}s"

# 6) Sağlık kontrolü
sleep 2
PORT="$(grep -E '^PORT=' .env.production | cut -d= -f2 || echo 3000)"
if curl -fsS --max-time 5 "http://127.0.0.1:${PORT}/api/health" >/dev/null; then
  ok "Sağlık kontrolü PASS"
else
  warn "Sağlık kontrolü başarısız — pm2 logs $PM2_NAME ile inceleyin"
  exit 1
fi
