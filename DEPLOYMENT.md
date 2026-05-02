# Find And Study — Hostinger VPS Dağıtım Rehberi

Bu rehber, projenin önce **GitHub**'a, ardından **Hostinger VPS**'e
güvenli ve sürdürülebilir biçimde alınmasını adım adım anlatır.

> **Önemli:** Üretime almadan önce `replit.md` ve bu rehberle birlikte
> sunulan **Güvenlik İncelemesi**ndeki kritik (CRITICAL) maddeleri
> mutlaka düzeltin (özellikle `x-user-id` başlık tabanlı oturum ve
> düz-metin parola geri-uyumluluğu — aşağıdaki "Üretim Öncesi
> Düzeltmeler" bölümüne bakın).

---

## 1. GitHub'a İlk Yükleme

```bash
# Yerel (veya Replit) ortamda:
git --no-optional-locks status                    # mevcut durumu kontrol edin
git remote add origin git@github.com:<KULLANICI>/<REPO>.git
git branch -M main
git push -u origin main
```

GitHub'da `Settings → Secrets and variables → Actions` altında şunları ekleyin:

| Tür      | Ad                       | Değer                                                          |
|----------|--------------------------|----------------------------------------------------------------|
| Variable | `PRODUCTION_DOMAIN`      | `findandstudy.com`                                             |
| Variable | `VPS_HOST`               | VPS'in IP adresi veya hostname'i                               |
| Variable | `VPS_USER`               | `deploy`                                                       |
| Secret   | `VPS_SSH_PRIVATE_KEY`    | `~/.ssh/id_ed25519` özel anahtarın içeriği (deploy kullanıcısı için)|
| Secret   | `VPS_SSH_KNOWN_HOSTS`    | `ssh-keyscan -H <VPS_IP>` çıktısı                              |

Bunlar yapıldıktan sonra `main`'e her push otomatik üretime yansır.

---

## 2. Hostinger VPS — İlk Kurulum (tek seferlik)

### 2.1. VPS'i sipariş edin
- Hostinger Cloud Hosting değil, **VPS Hosting** seçin (KVM 1 / KVM 2 yeterli).
- Şablon olarak **Ubuntu 24.04 LTS** seçin.

### 2.2. SSH ile bağlanın
```bash
ssh root@<VPS_IP>
```

### 2.3. Bootstrap betiğini çalıştırın
```bash
wget -O vps-setup.sh https://raw.githubusercontent.com/<KULLANICI>/<REPO>/main/scripts/vps-setup.sh
bash vps-setup.sh
```

Bu betik Node 20, PostgreSQL 16, nginx, PM2, certbot, UFW ve fail2ban
kurar; `deploy` adında non-root bir kullanıcı oluşturur.

### 2.4. Veritabanı kullanıcısını oluşturun
```bash
sudo -u postgres psql <<EOF
CREATE USER findandstudy_user WITH PASSWORD '$(openssl rand -hex 24)';
CREATE DATABASE findandstudy OWNER findandstudy_user;
\c findandstudy
CREATE EXTENSION IF NOT EXISTS pg_trgm;
EOF
```

> `pg_trgm` uzantısı zaten uygulama başlangıcında otomatik
> oluşturulmaya çalışılıyor; superuser haklarıyla manuel
> oluşturmak en güvenlisi.

### 2.5. `.env.production` dosyasını yerleştirin
```bash
sudo nano /var/www/findandstudy/shared/.env.production
# .env.production.example dosyasındaki örneğe göre doldurun.
# SESSION_SECRET için: openssl rand -hex 64
sudo chown deploy:deploy /var/www/findandstudy/shared/.env.production
sudo chmod 600 /var/www/findandstudy/shared/.env.production
```

### 2.6. Domain'i yönlendirin
Hostinger paneli → DNS → `A` kaydı:
- `@` → `<VPS_IP>`
- `www` → `<VPS_IP>`

### 2.7. nginx vhost'unu kopyalayın
```bash
sudo cp /var/www/findandstudy/current/nginx/findandstudy.conf /etc/nginx/sites-available/findandstudy
sudo ln -s /etc/nginx/sites-available/findandstudy /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default || true
sudo nginx -t && sudo systemctl reload nginx
```

### 2.8. HTTPS sertifikası
```bash
sudo certbot --nginx -d findandstudy.com -d www.findandstudy.com
sudo systemctl enable certbot.timer
```

---

## 3. İlk Manuel Release (CI/CD'yi açmadan önce)

```bash
su - deploy
cd /var/www/findandstudy
git clone https://github.com/<KULLANICI>/<REPO>.git releases/initial
cd releases/initial
npm ci
npm run build
npm run db:push   # ilk şema kurulumu — sadece bir kez

# Symlink'ler
ln -sfn /var/www/findandstudy/shared/uploads public/uploads
ln -sfn /var/www/findandstudy/shared/.env.production .env.production
ln -sfn /var/www/findandstudy/releases/initial /var/www/findandstudy/current

# PM2 başlat
pm2 start ecosystem.config.cjs --env production
pm2 save
sudo env PATH=$PATH pm2 startup systemd -u deploy --hp /home/deploy
```

Tarayıcıdan `https://findandstudy.com` adresine gidin — `en@findandstudy.com / admin123` ile giriş yapın ve **derhal parolayı değiştirin**.

---

## 4. CI/CD — Sonraki Tüm Release'ler

`main` branch'e push yaptığınızda `.github/workflows/deploy.yml`:

1. Build alır (Vite + esbuild)
2. Yeni bir `releases/<timestamp>/` klasörü açar (rsync ile)
3. `scripts/release.sh` çalıştırır:
   - `npm ci` (production)
   - `npm run build`
   - `current` symlink'ini yeni release'e çevirir
   - PM2'yi sıfır-kesinti `reload` ile yeniden yükler
   - Son 5 release dışındakileri siler
4. Sağlık kontrolü (`/api/health`)

> **Geri dönüş:** `cd /var/www/findandstudy && ln -sfn releases/<önceki> current && pm2 reload findandstudy`

---

## 5. Alternatif: Docker ile Dağıtım

Docker tercih ederseniz PM2'yi ve nginx'i konteyner içinden çalıştırabilirsiniz:

```bash
cd /var/www/findandstudy/current
cp .env.production.example .env.production && nano .env.production
docker compose --env-file .env.production up -d --build
docker compose exec app npm run db:push    # ilk kez
```

> Hostinger VPS'de Docker hazır gelmiyor; `apt install docker.io docker-compose-v2` ile kurun.

---

## 6. Üretim Öncesi DÜZELTILMESI Gereken Kritik Maddeler

| # | Konu                                          | Risk          | Tahmini efor |
|---|-----------------------------------------------|---------------|--------------|
| 1 | `x-user-id` başlığıyla kimlik doğrulama       | **CRITICAL**  | 4-6 saat     |
| 2 | Düz-metin parola karşılaştırma geri-uyumluluğu| **CRITICAL**  | 30 dk        |
| 3 | Hardcoded admin parolası (`admin123`)         | **HIGH**      | 15 dk        |
| 4 | CORS yok, tüm origin'lere açık                | **HIGH**      | 15 dk        |
| 5 | `helmet` middleware yok                       | **HIGH**      | 15 dk        |
| 6 | E-posta şablonlarında HTML interpolation      | **MEDIUM**    | 1 saat       |
| 7 | `npm audit` 4 critical, 30 high, 25 moderate  | **MEDIUM**    | 2-4 saat     |
| 8 | TypeScript 16 hata (build pas geçiyor)        | **LOW**       | 1-2 saat     |
| 9 | `db:push` yerine drizzle-kit migrations       | **LOW**       | 1 saat       |

Detaylı açıklamalar için **Güvenlik İncelemesi** mesajına bakın.

---

## 7. Yedekleme

Otomatik DB yedeği (cron):
```bash
sudo crontab -e
# Her gece 03:00'te
0 3 * * * sudo -u postgres pg_dump findandstudy | gzip > /var/backups/findandstudy-$(date +\%Y\%m\%d).sql.gz && find /var/backups -name 'findandstudy-*.sql.gz' -mtime +14 -delete
```

`/var/www/findandstudy/shared/uploads/` klasörünü ayrıca rsync ile başka bir
sunucuya veya S3'e yedekleyin.

---

## 8. İzleme

- **Loglar:** `pm2 logs findandstudy --lines 200`
- **Sistem:** `htop`, `pm2 monit`, `journalctl -u nginx -f`
- **Durum:** `https://findandstudy.com/api/health`
- Önerilen: Uptime monitoring için [UptimeRobot](https://uptimerobot.com) (ücretsiz).
