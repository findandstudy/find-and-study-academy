# Find And Study — Hostinger VPS Dağıtım Rehberi

Bu rehber, projenin **GitHub → Hostinger VPS** ile **OpenLiteSpeed + PM2 + PostgreSQL**
kullanarak nasıl üretime alınacağını 6 adımda anlatır.

---

## 1. GitHub'a İlk Yükleme

Yerel makinenizde (veya Replit'te):

```bash
git remote add origin git@github.com:<KULLANICI>/<REPO>.git
git branch -M main
git push -u origin main
```

> Eğer yeni bir repo açmanız gerekiyorsa: github.com/new → adı `findandstudy-portal`
> (private önerilir).

---

## 2. Hostinger VPS Hazırlığı

1. Hostinger panelinde **VPS Hosting** → **Ubuntu 22.04** veya **24.04** template'i seçin.
2. **OpenLiteSpeed** Hostinger'da varsayılan olarak gelir — herhangi bir şey yapmaya gerek yok.
3. SSH ile bağlanın:
   ```bash
   ssh root@<VPS_IP>
   ```
4. Domain DNS'ini Hostinger panelinden ayarlayın:
   - `A` kaydı: `academy` → `<VPS_IP>`
   - DNS yayılması için 5-10 dk bekleyin.

---

## 3. Otomatik Kurulum (Tek Komut)

VPS'te root olarak şunu çalıştırın:

```bash
wget -O setup-vps.sh https://raw.githubusercontent.com/<KULLANICI>/<REPO>/main/scripts/setup-vps.sh
bash setup-vps.sh
```

Betik size sırayla şunları soracak:
- Domain (örn: `academy.findandstudy.com`)
- GitHub repo URL'i
- Let's Encrypt için e-posta
- PostgreSQL parolası (boşsa otomatik üretir)
- İlk admin parolası

Sonrasında otomatik olarak:
- ✅ Node 20, PostgreSQL 16, PM2 kurar
- ✅ `findandstudy` veritabanı + kullanıcı oluşturur (pg_trgm uzantısıyla)
- ✅ Repo'yu `/var/www/findandstudy`'e klonlar
- ✅ `npm ci && npm run build` çalıştırır
- ✅ `.env.production` dosyasını oluşturur (chmod 600)
- ✅ `npm run db:push` ile şemayı uygular
- ✅ PM2 ile uygulamayı başlatır + sistem boot'unda otomatik başlatma
- ✅ OpenLiteSpeed'i `127.0.0.1:3000`'e ters proxy yapacak şekilde ayarlar
- ✅ UFW firewall (80, 443, 22, 7080) + fail2ban
- ✅ Let's Encrypt sertifikası (otomatik yenilemeli cron'a eklenir)

Kurulum yaklaşık **5-10 dakika** sürer.

---

## 4. İlk Kontroller

Tarayıcıdan şunu açın: **https://academy.findandstudy.com**

İlk giriş:
- E-posta: `en@findandstudy.com`
- Parola: setup sırasında girdiğiniz parola

> **DERHAL** Ayarlar → Profil'den parolayı değiştirin.

VPS üzerinde hızlı kontrol:
```bash
pm2 status                           # uygulama çalışıyor mu?
pm2 logs findandstudy --lines 50     # son 50 log satırı
curl http://127.0.0.1:3000/api/health   # sağlık endpoint'i
```

---

## 5. Sonraki Release'ler — Tek Komut

Yeni kod GitHub'a push edildikten sonra VPS'te:

```bash
ssh deploy@<VPS_IP>
cd /var/www/findandstudy
bash scripts/deploy.sh
```

Bu betik şunları yapar:
1. `git pull`
2. `npm ci`
3. `npm run build`
4. `npm run db:push` (veya migration varsa `drizzle-kit migrate`)
5. `pm2 reload findandstudy` (sıfır kesinti)
6. `/api/health` ile sağlık kontrolü

---

## 6. Önemli Komutlar (Cheat Sheet)

| İhtiyaç | Komut |
|---------|-------|
| Uygulama durumu | `pm2 status` |
| Canlı log | `pm2 logs findandstudy` |
| Yeniden başlat | `pm2 restart findandstudy` |
| Sıfır kesinti reload | `pm2 reload findandstudy` |
| OpenLiteSpeed restart | `/usr/local/lsws/bin/lswsctrl restart` |
| OpenLiteSpeed admin | `https://<VPS_IP>:7080` |
| nginx hata logu (kullanılmıyor) | — |
| DB'ye bağlan | `sudo -u postgres psql findandstudy` |
| Env dosyası | `/var/www/findandstudy/.env.production` |
| SSL yenileme (manuel test) | `certbot renew --dry-run` |
| DB yedek (manuel) | `sudo -u postgres pg_dump findandstudy \| gzip > /var/backups/db-$(date +%F).sql.gz` |

### Otomatik DB Yedekleme (önerilir)
```bash
sudo crontab -e
# Her gece 03:00:
0 3 * * * sudo -u postgres pg_dump findandstudy | gzip > /var/backups/findandstudy-$(date +\%Y\%m\%d).sql.gz && find /var/backups -name 'findandstudy-*.sql.gz' -mtime +14 -delete
```

---

## Sorun Giderme

| Belirti | Çözüm |
|---------|-------|
| 502 Bad Gateway | `pm2 logs findandstudy` — uygulama crashed mı kontrol edin |
| SSL hatası | `certbot certonly --webroot -w /var/www/findandstudy/dist/public -d academy.findandstudy.com` |
| DB bağlantı hatası | `.env.production` içindeki `DATABASE_URL` doğru mu, postgres çalışıyor mu (`systemctl status postgresql`) |
| Yüksek bellek | `pm2 monit` ile process'leri inceleyin; max_memory_restart `ecosystem.config.cjs`'de 1GB |
| Permission denied (uploads) | `chown -R deploy:deploy /var/www/findandstudy/public/uploads` |

---

## Güvenlik Notları

- ✅ SESSION_SECRET her VPS için **otomatik üretiliyor** (setup-vps.sh)
- ✅ Cookie httpOnly + secure + sameSite=lax
- ✅ helmet + CORS (sadece izin verilen domain) + rate-limit
- ✅ Düz-metin parola karşılaştırması KALDIRILDI — sadece bcrypt
- ✅ /uploads erişimi kimlik doğrulamalı
- ⚠️ OpenLiteSpeed admin paneli (7080) — sadece kendi IP'nizden erişin:
  `ufw delete allow 7080/tcp && ufw allow from <SİZİN_IP> to any port 7080`
- ⚠️ İlk girişin ardından admin parolasını **mutlaka** değiştirin.
