#!/bin/bash
# ============================================================================
# Hostinger VPS — ilk kurulum betiği (Ubuntu 22.04 / 24.04)
# ============================================================================
# Kullanım:
#   1) VPS'e SSH ile root olarak bağlanın
#   2) wget -O - https://raw.githubusercontent.com/<user>/<repo>/main/scripts/vps-setup.sh | bash
#      (veya bu dosyayı VPS'e kopyalayıp `bash vps-setup.sh` çalıştırın)
#
# Yaptıkları:
#   - Sistem güncelleme + temel paketler
#   - Node 20 (NodeSource) kurulumu
#   - PostgreSQL 16 kurulumu (yerel kullanım için)
#   - nginx + certbot
#   - PM2 global kurulumu
#   - UFW firewall (22, 80, 443 açık)
#   - fail2ban
#   - 'deploy' adında non-root kullanıcı + SSH anahtarı
# ============================================================================

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Bu betik root olarak çalıştırılmalı. 'sudo bash vps-setup.sh' deneyin."
  exit 1
fi

echo "==> Sistem güncelleniyor"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg lsb-release ufw fail2ban git build-essential

echo "==> Node.js 20 kuruluyor"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "==> PM2 kuruluyor"
npm install -g pm2

echo "==> PostgreSQL 16 kuruluyor"
sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
apt-get update -y
apt-get install -y postgresql-16 postgresql-contrib-16
systemctl enable --now postgresql

echo "==> nginx + certbot kuruluyor"
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx

echo "==> Firewall (UFW) ayarlanıyor"
ufw allow OpenSSH
ufw allow 'Nginx Full'
echo "y" | ufw enable

echo "==> fail2ban etkinleştiriliyor"
systemctl enable --now fail2ban

echo "==> 'deploy' kullanıcısı oluşturuluyor"
if ! id -u deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
  usermod -aG sudo deploy
  mkdir -p /home/deploy/.ssh
  if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
  fi
  chown -R deploy:deploy /home/deploy/.ssh
  chmod 700 /home/deploy/.ssh
  chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
fi

echo "==> /var/www/findandstudy hazırlanıyor"
mkdir -p /var/www/findandstudy/{releases,shared/uploads/{profiles,logos,content,knowledge},shared/logs}
touch /var/www/findandstudy/shared/uploads/profiles/.gitkeep
touch /var/www/findandstudy/shared/uploads/logos/.gitkeep
touch /var/www/findandstudy/shared/uploads/content/.gitkeep
touch /var/www/findandstudy/shared/uploads/knowledge/.gitkeep
chown -R deploy:deploy /var/www/findandstudy

cat <<'EOF'

============================================================================
✓ VPS hazır.
============================================================================
Sıradaki adımlar:
  1) PostgreSQL kullanıcısı + veritabanı:
       sudo -u postgres psql
       CREATE USER findandstudy_user WITH PASSWORD 'GUCLU_PAROLA';
       CREATE DATABASE findandstudy OWNER findandstudy_user;
       \q

  2) Domain'inizin A kaydını VPS IP'sine yönlendirin (Hostinger panelinden).

  3) /var/www/findandstudy/shared/.env.production dosyasını oluşturun
     (örnek: .env.production.example).

  4) İlk release:
       su - deploy
       cd /var/www/findandstudy
       git clone https://github.com/<user>/<repo>.git current
       cd current
       npm ci
       npm run build
       npm run db:push
       ln -sfn /var/www/findandstudy/shared/uploads public/uploads
       ln -sfn /var/www/findandstudy/shared/.env.production .env.production
       pm2 start ecosystem.config.cjs --env production
       pm2 save && sudo env PATH=$PATH pm2 startup systemd -u deploy --hp /home/deploy

  5) HTTPS sertifikası:
       sudo certbot --nginx -d findandstudy.com -d www.findandstudy.com

============================================================================
EOF
