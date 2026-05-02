#!/bin/bash
# ============================================================================
# Yeni release'i atomik olarak devreye al (zero-downtime)
# ============================================================================
# Kullanım: bash scripts/release.sh <RELEASE_ID>
# (GitHub Actions tarafından otomatik çağrılır.)
#
# Beklenen yapı:
#   /var/www/findandstudy/
#     ├── current -> releases/20260502120000   (symlink)
#     ├── releases/
#     │   ├── 20260502120000/  (yeni gelen)
#     │   └── ...
#     └── shared/
#         ├── .env.production
#         └── uploads/
# ============================================================================

set -euo pipefail

RELEASE="${1:?RELEASE_ID parametresi gerekli}"
BASE=/var/www/findandstudy
RELEASE_DIR="$BASE/releases/$RELEASE"
SHARED_DIR="$BASE/shared"

echo "==> Release: $RELEASE_DIR"
cd "$RELEASE_DIR"

echo "==> Bağımlılıklar"
npm ci --no-audit --no-fund --omit=dev

echo "==> Build"
npm run build

echo "==> Paylaşılan dosyalara symlink"
rm -rf public/uploads
ln -sfn "$SHARED_DIR/uploads" public/uploads
ln -sfn "$SHARED_DIR/.env.production" .env.production

echo "==> Veritabanı şeması (varsa)"
# db:push üretimde RİSKLİ olabilir — büyük şema değişikliğinde önce migration üretin.
# İsteğe bağlı: npm run db:push
# Şimdilik sadece migration dosyaları varsa uygula:
if [[ -d migrations ]] && [[ -n "$(ls -A migrations 2>/dev/null)" ]]; then
  echo "   → drizzle migrate çalıştırılıyor"
  npx drizzle-kit migrate || echo "⚠️  Migration başarısız — manuel müdahale gerekebilir"
fi

echo "==> Önceki release'i değiştir"
ln -sfn "$RELEASE_DIR" "$BASE/current"

echo "==> PM2 reload (zero-downtime)"
cd "$BASE/current"
if pm2 describe findandstudy >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --env production --update-env
else
  pm2 start ecosystem.config.cjs --env production
fi
pm2 save

echo "==> Eski release'leri temizle (en son 5'i tut)"
cd "$BASE/releases"
ls -1t | tail -n +6 | xargs -r rm -rf

echo "✓ Release $RELEASE devreye alındı"
