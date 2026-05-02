#!/usr/bin/env bash
# ============================================================================
# Find And Study — Hostinger VPS İlk Kurulum Betiği
# ============================================================================
# Hedef: Ubuntu 22.04 / 24.04 + OpenLiteSpeed (önceden kurulu)
# Domain: academy.findandstudy.com
# Backend port: 3000 (OpenLiteSpeed reverse proxy yapacak)
#
# Kullanım:
#   1) VPS'e root olarak SSH yapın
#   2) Bu betiği VPS'e kopyalayın. Repo private olduğu için wget çalışmaz; yerel
#      makinenizden scp ile gönderin:
#         scp scripts/setup-vps.sh root@<VPS_IP>:/root/setup-vps.sh
#      veya nano ile yapıştırın:
#         nano /root/setup-vps.sh   (içeriği yapıştırıp Ctrl+O, Enter, Ctrl+X)
#   3) chmod +x /root/setup-vps.sh && bash /root/setup-vps.sh
#
# Bu betik repoyu SSH Deploy Key ile çeker — bu yüzden GitHub repo URL'sini
# SSH formatında verin (git@github.com:owner/repo.git). HTTPS verirseniz
# otomatik SSH'a çevrilir.
# ============================================================================

set -euo pipefail

# Renkler
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}==> $*${NC}"; }
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
err()  { echo -e "${RED}✗ $*${NC}" >&2; }

if [[ "${EUID}" -ne 0 ]]; then
  err "Bu betik root olarak çalıştırılmalı. 'sudo bash setup-vps.sh' deneyin."
  exit 1
fi

DOMAIN="${DOMAIN:-academy.findandstudy.com}"
APP_DIR="/var/www/findandstudy"
APP_USER="deploy"
NODE_PORT="3000"
LSWS_DIR="/usr/local/lsws"

# ─────────────────────────────────────────────────────────────────────────────
# 1) Etkileşimli sorular
# ─────────────────────────────────────────────────────────────────────────────
echo
log "Önce birkaç bilgiye ihtiyacım var (Enter = varsayılan)"
read -rp "Domain [$DOMAIN]: " input_domain && DOMAIN="${input_domain:-$DOMAIN}"
read -rp "GitHub repo URL (örn: git@github.com:findandstudy/find-and-study-academy.git): " GIT_URL
[[ -z "$GIT_URL" ]] && { err "GitHub repo URL gerekli"; exit 1; }
# HTTPS verildiyse otomatik olarak SSH formatına çevir
if [[ "$GIT_URL" =~ ^https://github\.com/([^/]+)/([^/]+)\.git$ ]]; then
  GIT_URL="git@github.com:${BASH_REMATCH[1]}/${BASH_REMATCH[2]}.git"
  warn "Repo URL SSH formatına çevrildi: $GIT_URL"
fi
if [[ ! "$GIT_URL" =~ ^git@github\.com: ]]; then
  err "Repo URL beklenen formatta değil. Beklenen: git@github.com:owner/repo.git"
  exit 1
fi
read -rp "Let's Encrypt için e-posta: " LETSENCRYPT_EMAIL
[[ -z "$LETSENCRYPT_EMAIL" ]] && { err "E-posta gerekli"; exit 1; }
read -rsp "PostgreSQL kullanıcısı için yeni parola (boşsa otomatik üretilir): " PG_PASSWORD
echo
[[ -z "$PG_PASSWORD" ]] && PG_PASSWORD="$(openssl rand -hex 24)"

SESSION_SECRET="$(openssl rand -hex 64)"
read -rsp "İlk admin parolası (boşsa varsayılan 'admin123' kullanılır — DEPLOY SONRASI DEĞİŞTİRİN): " ADMIN_PWD
echo
[[ -z "$ADMIN_PWD" ]] && ADMIN_PWD="admin123"

echo
log "Domain        : $DOMAIN"
log "Git repo      : $GIT_URL"
log "Let's Encrypt : $LETSENCRYPT_EMAIL"
log "App klasör    : $APP_DIR"
log "Backend port  : $NODE_PORT"
echo
read -rp "Devam edelim mi? (e/h): " confirm
[[ "$confirm" != "e" && "$confirm" != "E" ]] && { err "İptal edildi"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# 2) Sistem güncelleme
# ─────────────────────────────────────────────────────────────────────────────
log "Sistem paketleri güncelleniyor"
apt-get update -y
apt-get install -y curl ca-certificates gnupg lsb-release ufw fail2ban git build-essential rsync
ok "Temel paketler hazır"

# ─────────────────────────────────────────────────────────────────────────────
# 3) Node.js 20
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]]; then
  log "Node.js 20 kuruluyor"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
ok "Node $(node -v), npm $(npm -v)"

# ─────────────────────────────────────────────────────────────────────────────
# 4) PM2
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  log "PM2 kuruluyor"
  npm install -g pm2
fi
ok "PM2 hazır"

# ─────────────────────────────────────────────────────────────────────────────
# 5) PostgreSQL 16
# ─────────────────────────────────────────────────────────────────────────────
if ! command -v psql >/dev/null 2>&1; then
  log "PostgreSQL 16 kuruluyor"
  install -d /usr/share/postgresql-common/pgdg
  curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
  sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  apt-get update -y
  apt-get install -y postgresql-16 postgresql-contrib-16
  systemctl enable --now postgresql
fi
ok "PostgreSQL hazır"

log "Veritabanı ve kullanıcı oluşturuluyor"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='findandstudy_user'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER findandstudy_user WITH PASSWORD '${PG_PASSWORD}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='findandstudy'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE findandstudy OWNER findandstudy_user;"
sudo -u postgres psql -d findandstudy -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;" >/dev/null
ok "DB: findandstudy / kullanıcı: findandstudy_user"

# ─────────────────────────────────────────────────────────────────────────────
# 6) Firewall (UFW)
# ─────────────────────────────────────────────────────────────────────────────
log "Firewall ayarlanıyor"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 7080/tcp >/dev/null   # OpenLiteSpeed admin paneli (sadece güvendiğiniz IP'lerden açın!)
yes | ufw enable >/dev/null 2>&1 || true
systemctl enable --now fail2ban
ok "UFW + fail2ban aktif"

# ─────────────────────────────────────────────────────────────────────────────
# 7) deploy kullanıcısı
# ─────────────────────────────────────────────────────────────────────────────
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  log "'$APP_USER' kullanıcısı oluşturuluyor"
  adduser --disabled-password --gecos "" "$APP_USER"
  usermod -aG sudo "$APP_USER"
  if [[ -f /root/.ssh/authorized_keys ]]; then
    install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
    cp /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/authorized_keys"
    chown "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh/authorized_keys"
    chmod 600 "/home/$APP_USER/.ssh/authorized_keys"
  fi
fi
ok "deploy kullanıcısı hazır"

# ─────────────────────────────────────────────────────────────────────────────
# 7.5) GitHub SSH Deploy Key — private repo'dan read-only çekmek için
# ─────────────────────────────────────────────────────────────────────────────
SSH_KEY_PATH="/root/.ssh/github_deploy"
install -d -m 700 /root/.ssh

if [[ ! -f "$SSH_KEY_PATH" ]]; then
  log "GitHub Deploy Key oluşturuluyor: $SSH_KEY_PATH"
  ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "deploy@${DOMAIN}"
  chmod 600 "$SSH_KEY_PATH"
  chmod 644 "${SSH_KEY_PATH}.pub"
else
  ok "Mevcut deploy key kullanılacak: $SSH_KEY_PATH"
fi

# Repo URL'den owner/repo'yu çıkar (deploy keys ekleme linki için)
REPO_PATH="$(echo "$GIT_URL" | sed -E 's#^git@github\.com:([^/]+/[^.]+)\.git$#\1#')"
DEPLOY_KEYS_URL="https://github.com/${REPO_PATH}/settings/keys/new"

echo
echo "════════════════════════════════════════════════════════════════════"
echo "GitHub'da DEPLOY KEY olarak eklenecek public key:"
echo "════════════════════════════════════════════════════════════════════"
cat "${SSH_KEY_PATH}.pub"
echo "════════════════════════════════════════════════════════════════════"
echo
warn "ŞİMDİ YAPMANIZ GEREKEN ADIMLAR:"
echo "  1) Tarayıcıda şu adresi açın:"
echo "     ${DEPLOY_KEYS_URL}"
echo "  2) Title: 'Hostinger VPS Deploy' (veya istediğiniz bir isim)"
echo "  3) Key alanına yukarıdaki public key'i (ssh-ed25519 ile başlayan tüm satır) yapıştırın"
echo "  4) 'Allow write access' KUTUSUNU İŞARETLEMEYİN — read-only deploy key daha güvenli"
echo "  5) 'Add key' butonuna basın"
echo
read -rp "Deploy key'i GitHub'a ekledikten sonra Enter'a basın... " _

# /root için SSH config — github.com için bu key kullanılsın
SSH_CONFIG="/root/.ssh/config"
if ! grep -qE "^Host github\.com$" "$SSH_CONFIG" 2>/dev/null; then
  cat >> "$SSH_CONFIG" <<EOF

Host github.com
  HostName github.com
  User git
  IdentityFile ${SSH_KEY_PATH}
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
fi
chmod 600 "$SSH_CONFIG"

# Doğrulama: GitHub'a SSH ile bağlanıp deploy key'i kabul ettiklerini gör
log "GitHub SSH bağlantısı doğrulanıyor"
SSH_TEST_OUTPUT="$(ssh -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1 || true)"
echo "$SSH_TEST_OUTPUT"
if echo "$SSH_TEST_OUTPUT" | grep -qE "successfully authenticated|Hi |You've successfully"; then
  ok "GitHub SSH erişimi onaylandı"
else
  err "GitHub SSH erişimi doğrulanamadı! Public key'i Deploy Key olarak eklediğinizden emin olun."
  err "Manuel test: ssh -T git@github.com"
  read -rp "Yine de devam edelim mi? (e/h): " continue_anyway
  [[ "$continue_anyway" != "e" && "$continue_anyway" != "E" ]] && exit 1
fi

# deploy kullanıcısı da aynı key'i kullansın (clone + deploy.sh git pull için)
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
cp "$SSH_KEY_PATH" "/home/$APP_USER/.ssh/github_deploy"
cp "${SSH_KEY_PATH}.pub" "/home/$APP_USER/.ssh/github_deploy.pub"
chown "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh/github_deploy" "/home/$APP_USER/.ssh/github_deploy.pub"
chmod 600 "/home/$APP_USER/.ssh/github_deploy"
chmod 644 "/home/$APP_USER/.ssh/github_deploy.pub"

DEPLOY_SSH_CONFIG="/home/$APP_USER/.ssh/config"
if ! grep -qE "^Host github\.com$" "$DEPLOY_SSH_CONFIG" 2>/dev/null; then
  cat >> "$DEPLOY_SSH_CONFIG" <<EOF

Host github.com
  HostName github.com
  User git
  IdentityFile /home/${APP_USER}/.ssh/github_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
fi
chown "$APP_USER:$APP_USER" "$DEPLOY_SSH_CONFIG"
chmod 600 "$DEPLOY_SSH_CONFIG"

# deploy user için known_hosts'a github.com'u ekle (sessizce)
sudo -u "$APP_USER" ssh -o StrictHostKeyChecking=accept-new -T git@github.com >/dev/null 2>&1 || true
ok "deploy kullanıcısı için de SSH ayarlandı"

# ─────────────────────────────────────────────────────────────────────────────
# 8) Repo klonla + bağımlılıklar
# ─────────────────────────────────────────────────────────────────────────────
log "Uygulama klasörü hazırlanıyor: $APP_DIR"
mkdir -p "$APP_DIR" "$APP_DIR/logs"
mkdir -p "$APP_DIR/public/uploads/profiles"
mkdir -p "$APP_DIR/public/uploads/logos"
mkdir -p "$APP_DIR/public/uploads/content"
mkdir -p "$APP_DIR/public/uploads/knowledge"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "Repo klonlanıyor"
  sudo -u "$APP_USER" git clone "$GIT_URL" "$APP_DIR"
fi

cd "$APP_DIR"
sudo -u "$APP_USER" git pull --ff-only
log "Bağımlılıklar (npm ci) — birkaç dakika sürebilir"
sudo -u "$APP_USER" -H bash -c "cd $APP_DIR && npm ci"
log "Build (vite + esbuild)"
sudo -u "$APP_USER" -H bash -c "cd $APP_DIR && npm run build"

# ─────────────────────────────────────────────────────────────────────────────
# 9) .env.production
# ─────────────────────────────────────────────────────────────────────────────
log ".env.production dosyası yazılıyor"
cat > "$APP_DIR/.env.production" <<EOF
NODE_ENV=production
PORT=${NODE_PORT}
DATABASE_URL=postgres://findandstudy_user:${PG_PASSWORD}@127.0.0.1:5432/findandstudy
SESSION_SECRET=${SESSION_SECRET}
ALLOWED_ORIGIN=https://${DOMAIN}
ADMIN_INITIAL_EMAIL=en@findandstudy.com
ADMIN_INITIAL_PASSWORD=${ADMIN_PWD}
SMTP_HOST=smtp.yandex.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM_NAME=Find & Study Academy
N8N_WEBHOOK_URL=
EOF
chown "$APP_USER:$APP_USER" "$APP_DIR/.env.production"
chmod 600 "$APP_DIR/.env.production"
ok ".env.production hazır (chmod 600)"

# ─────────────────────────────────────────────────────────────────────────────
# 10) DB şeması
# ─────────────────────────────────────────────────────────────────────────────
log "DB şeması push ediliyor (drizzle)"
sudo -u "$APP_USER" -H bash -c "cd $APP_DIR && DATABASE_URL='postgres://findandstudy_user:${PG_PASSWORD}@127.0.0.1:5432/findandstudy' npm run db:push" || warn "db:push başarısız — manuel kontrol gerekebilir"

# ─────────────────────────────────────────────────────────────────────────────
# 11) PM2 başlat
# ─────────────────────────────────────────────────────────────────────────────
log "PM2 ile uygulama başlatılıyor"
sudo -u "$APP_USER" -H bash -c "cd $APP_DIR && pm2 start ecosystem.config.cjs --env production && pm2 save"
env PATH="$PATH" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash || true
ok "PM2 başlatma scripti sistemd'ye kaydedildi"

# ─────────────────────────────────────────────────────────────────────────────
# 12) OpenLiteSpeed reverse proxy
# ─────────────────────────────────────────────────────────────────────────────
if [[ ! -d "$LSWS_DIR" ]]; then
  warn "OpenLiteSpeed bulunamadı ($LSWS_DIR). Hostinger varsayılan kurulumunda gelmiş olmalı."
  warn "Manuel olarak https://openlitespeed.org/kb/install-from-binary/ adımlarını uygulayın."
else
  log "OpenLiteSpeed reverse proxy hazırlanıyor"
  # External app (Web Server) tanımı — Node backend'i
  EXT_APP_FILE="$LSWS_DIR/conf/externalapp.d/findandstudy.conf"
  install -d "$LSWS_DIR/conf/externalapp.d"
  cat > "$EXT_APP_FILE" <<EOF
extprocessor findandstudy_node {
  type                    proxy
  address                 http://127.0.0.1:${NODE_PORT}
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}
EOF
  ok "External app tanımı: $EXT_APP_FILE"

  # vhost config
  VHOST_DIR="$LSWS_DIR/conf/vhosts/${DOMAIN}"
  install -d "$VHOST_DIR"
  cat > "$VHOST_DIR/vhconf.conf" <<EOF
docRoot                   ${APP_DIR}/dist/public
vhDomain                  ${DOMAIN}
adminEmails               ${LETSENCRYPT_EMAIL}
enableGzip                1
enableBr                  1

errorlog \$VH_ROOT/logs/error.log {
  useServer               1
  logLevel                ERROR
}
accesslog \$VH_ROOT/logs/access.log {
  useServer               0
  rollingSize             10M
  keepDays                30
}

scripthandler {
  add                     proxy:findandstudy_node js
}

context / {
  type                    proxy
  handler                 findandstudy_node
  addDefaultCharset       off
}

context /uploads/ {
  location                ${APP_DIR}/public/uploads/
  allowBrowse             1
  expires                 1d
}
EOF
  install -d "$VHOST_DIR/logs"
  chown -R nobody:nogroup "$VHOST_DIR" 2>/dev/null || true
  ok "vhost config: $VHOST_DIR/vhconf.conf"

  # Listener'a vhost'u bağla (httpd_config.conf)
  HTTPD_CONF="$LSWS_DIR/conf/httpd_config.conf"
  if ! grep -q "vhName *${DOMAIN//./\\.}" "$HTTPD_CONF"; then
    cat >> "$HTTPD_CONF" <<EOF

virtualhost ${DOMAIN} {
  vhRoot                  ${VHOST_DIR}/
  configFile              ${VHOST_DIR}/vhconf.conf
  allowSymbolLink         1
  enableScript            1
  restrained              1
}

listener Default {
  map ${DOMAIN} ${DOMAIN}
}

listener SSL {
  map ${DOMAIN} ${DOMAIN}
}
EOF
    ok "vhost listener'a eklendi"
  fi

  log "OpenLiteSpeed yeniden başlatılıyor"
  "$LSWS_DIR/bin/lswsctrl" restart || systemctl restart lsws || warn "lsws restart başarısız — manuel restart"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 13) Let's Encrypt SSL (certbot)
# ─────────────────────────────────────────────────────────────────────────────
log "Certbot kuruluyor (snap üzerinden)"
if ! command -v certbot >/dev/null 2>&1; then
  apt-get install -y snapd
  snap install --classic certbot
  ln -sf /snap/bin/certbot /usr/bin/certbot
fi

log "Let's Encrypt sertifikası alınıyor — webroot yöntemiyle"
mkdir -p "$APP_DIR/.well-known/acme-challenge"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/.well-known"
certbot certonly --webroot -w "$APP_DIR/dist/public" \
  -d "$DOMAIN" --email "$LETSENCRYPT_EMAIL" \
  --agree-tos --non-interactive || warn "Sertifika alınamadı. DNS A kaydının doğru yönlendirildiğinden emin olun ve şu komutu çalıştırın: certbot certonly --webroot -w $APP_DIR/dist/public -d $DOMAIN"

if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  ok "Sertifika alındı"
  if [[ -d "$LSWS_DIR" ]]; then
    log "OpenLiteSpeed SSL ayarlanıyor"
    cat >> "$LSWS_DIR/conf/httpd_config.conf" <<EOF

listener SSL_${DOMAIN//./_} {
  address                 *:443
  secure                  1
  keyFile                 /etc/letsencrypt/live/${DOMAIN}/privkey.pem
  certFile                /etc/letsencrypt/live/${DOMAIN}/fullchain.pem
  map                     ${DOMAIN} ${DOMAIN}
}
EOF
    "$LSWS_DIR/bin/lswsctrl" restart || true
  fi
fi

# Otomatik yenileme cron
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook '$LSWS_DIR/bin/lswsctrl restart'") | sort -u | crontab -

# ─────────────────────────────────────────────────────────────────────────────
# 14) Sonuç
# ─────────────────────────────────────────────────────────────────────────────
echo
ok "════════════════════════════════════════════════════════════════════"
ok "Kurulum tamam! Tarayıcıdan https://${DOMAIN} adresine gidin."
ok "════════════════════════════════════════════════════════════════════"
echo
log "Yararlı komutlar:"
echo "  • pm2 status                                     — uygulama durumu"
echo "  • pm2 logs findandstudy --lines 100              — son loglar"
echo "  • pm2 reload findandstudy                        — yeniden yükle (sıfır kesinti)"
echo "  • bash $APP_DIR/scripts/deploy.sh                — yeni release çek + build + reload"
echo "  • $LSWS_DIR/bin/lswsctrl restart                 — OpenLiteSpeed yeniden başlat"
echo "  • cat $APP_DIR/.env.production                   — env dosyası"
echo
warn "İLK GİRİŞ: en@findandstudy.com / ${ADMIN_PWD}"
warn "İLK İŞ olarak admin parolasını mutlaka değiştirin!"
echo
