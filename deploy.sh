#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Safe deploy for academy.findandstudy.com
#
#   1. Type-check (tsc --noEmit)  → catches undefined refs / type errors BEFORE
#      anything touches the running app (this is what would have stopped the
#      "portalIcon is not defined" white-screen from ever shipping).
#   2. Back up the current build.
#   3. Build.
#   4. Restart the PM2 app.
#   5. Health check — if the app doesn't come back 200, roll back to the
#      previous build and restart again, then exit non-zero.
#
# Usage:  ./deploy.sh
#         PORT=5034 APP=academy ./deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

APP="${APP:-academy}"
PORT="${PORT:-5034}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/settings/defaults}"

say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

say "1/5  Type-check (tsc --noEmit)"
npx tsc --noEmit || die "Type-check failed — deploy aborted, running app untouched."

say "2/5  Back up current build"
rm -rf dist.prev
[ -d dist ] && cp -r dist dist.prev

say "3/5  Build"
if ! npm run build; then
  [ -d dist.prev ] && { rm -rf dist && mv dist.prev dist; }
  die "Build failed — restored previous build, running app untouched."
fi

say "4/5  Restart ${APP}"
pm2 restart "${APP}" --update-env >/dev/null

say "5/5  Health check (${HEALTH_URL})"
ok=0; code=""
for i in $(seq 1 12); do
  sleep 2
  code="$(curl -s -o /dev/null -w '%{http_code}' "${HEALTH_URL}" || true)"
  [ "$code" = "200" ] && { ok=1; break; }
done

if [ "$ok" != "1" ]; then
  printf '\033[1;31mHealth check failed (last HTTP %s) — rolling back.\033[0m\n' "${code:-none}" >&2
  if [ -d dist.prev ]; then
    rm -rf dist && mv dist.prev dist
    pm2 restart "${APP}" --update-env >/dev/null
    die "Rolled back to previous build. Check: pm2 logs ${APP}"
  fi
  die "No previous build to roll back to. Check: pm2 logs ${APP}"
fi

rm -rf dist.prev
printf '\n\033[1;32m✔ Deploy OK — %s healthy on :%s\033[0m\n' "${APP}" "${PORT}"
