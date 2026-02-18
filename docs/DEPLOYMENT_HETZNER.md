# Meta Ads Manager — Hetzner'da Yayınlama Rehberi

Bu rehber, projeyi **Hetzner Cloud** (VPS) üzerinde production ortamında çalıştırmak için adımları anlatır.

## Genel Bakış

- **Backend:** FastAPI (port 8000)
- **Frontend:** Next.js (port 3000)
- **Veritabanı:** PostgreSQL
- **Kuyruk:** RabbitMQ + Redis
- **Arka plan işleri:** Celery worker + Celery beat

---

## 1. Hetzner Sunucu Oluşturma

1. [Hetzner Cloud Console](https://console.hetzner.cloud) → Proje oluştur → **Add Server**.
2. **Konum:** Nuremberg veya Falkenstein.
3. **Image:** Ubuntu 24.04 LTS.
4. **Tip:** En az **CPX21** (3 vCPU, 4 GB RAM) önerilir; RabbitMQ + Postgres + Redis + backend + frontend + Celery için yeterli olur. Daha yoğun kullanımda CPX31.
5. **SSH key** ekleyin, root şifresi kaydedin.
6. Sunucu IP’inizi not edin (örn. `95.216.x.x`).

---

## 2. Sunucuya Bağlanma ve Temel Kurulum

SSH ile bağlanın:

```bash
ssh root@SUNUCU_IP
```

Güncelleme ve Docker kurulumu:

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose-v2
systemctl enable docker && systemctl start docker
```

(Alternatif: [Docker’ın resmi repo’su](https://docs.docker.com/engine/install/ubuntu/) ile de kurabilirsiniz.)

---

## 3. Projeyi Sunucuya Taşıma

**Seçenek A — Git ile (tercih edilen):**

```bash
apt install -y git
git clone https://github.com/KULLANICI/metaadsmanager.git
cd metaadsmanager
```

**Seçenek B — rsync ile (yerel makineden):**

```bash
# Kendi bilgisayarınızda (Windows’ta WSL veya Git Bash)
rsync -avz --exclude node_modules --exclude .git --exclude __pycache__ . root@SUNUCU_IP:/root/metaadsmanager/
```

---

## 4. Ortam Değişkenleri (.env)

Sunucuda `backend/.env` dosyasını oluşturun (`.env.example`’dan kopyalayıp düzenleyin):

```bash
cd /root/metaadsmanager
cp backend/.env.example backend/.env
nano backend/.env
```

**Production için mutlaka ayarlayın:**

| Değişken | Açıklama | Örnek |
|----------|----------|--------|
| `ENVIRONMENT` | `production` yapın | `production` |
| `CORS_ORIGINS` | Frontend adresiniz (HTTPS) | `https://yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | Tarayıcının API’ye erişeceği adres | `https://yourdomain.com` veya `https://api.yourdomain.com` |
| `META_ACCESS_TOKEN` | Meta kalıcı token | (System User token) |
| `META_AD_ACCOUNT_ID` | Reklam hesabı ID | `act_123456789` |
| `WEBHOOK_BASE_URL` | Webhook base URL (domain) | `https://yourdomain.com` |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook doğrulama token | Güçlü rastgele string |
| `META_APP_SECRET` | Meta uygulama secret | Meta Developers’tan |
| SMTP / AI anahtarları | E-posta ve AI için | (İsterseniz) |

Domain henüz yoksa geçici olarak:

- `CORS_ORIGINS=https://SUNUCU_IP:3000` veya sadece IP ile test için `http://SUNUCU_IP:3000`
- `NEXT_PUBLIC_API_URL=http://SUNUCU_IP:8000` (HTTP; sadece test için)

---

## 5. Production ile Çalıştırma

Domain’iniz **var** ise (örn. `yourdomain.com`):

```bash
cd /root/metaadsmanager
cp deploy/.env.prod.example .env
nano .env   # NEXT_PUBLIC_API_URL=https://yourdomain.com ve isteğe bağlı POSTGRES_PASSWORD

docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

(Proje kökündeki `.env` dosyası `docker compose` tarafından okunur; `export` yapmadan da çalışır.)

Domain **yoksa** (sadece IP ile test):

```bash
export NEXT_PUBLIC_API_URL=http://SUNUCU_IP:8000
export CORS_ORIGINS=http://SUNUCU_IP:3000
# backend/.env içinde CORS_ORIGINS'i de aynı şekilde güncelleyin

docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

Kontroller:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

- Frontend: `http://SUNUCU_IP:3000`
- Backend API: `http://SUNUCU_IP:8000`
- API dokümantasyon: `http://SUNUCU_IP:8000/docs`

---

## 6. Domain ve HTTPS (Nginx + Let’s Encrypt)

Domain’i sunucu IP’nize A kaydı ile yönlendirin (örn. `yourdomain.com` → SUNUCU_IP).

Nginx ve Certbot:

```bash
apt install -y nginx certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Nginx site konfigürasyonu:

```bash
cp deploy/nginx.conf.example /etc/nginx/sites-available/metaads
nano /etc/nginx/sites-available/metaads
```

Dosyada `yourdomain.com` geçen yerleri kendi domain’inizle değiştirin. SSL satırları Certbot tarafından eklenmiş olacaktır; yoksa:

- `ssl_certificate` ve `ssl_certificate_key` yollarını Certbot’un verdiği yollara göre ayarlayın.

Siteyi etkinleştirip Nginx’i yenileyin:

```bash
ln -s /etc/nginx/sites-available/metaads /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Bu durumda:

- **NEXT_PUBLIC_API_URL:** `https://yourdomain.com` (aynı domain, Nginx /api/’i backend’e yönlendirir)
- **CORS_ORIGINS:** `https://yourdomain.com`
- Kullanıcılar `https://yourdomain.com` üzerinden uygulamaya girer.

---

## 7. Güvenlik Duvarı (Firewall)

Sadece 80, 443 ve SSH açık kalsın (Nginx kullanıyorsanız 3000 ve 8000’i dışarı kapatabilirsiniz):

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
ufw status
```

Nginx kullanmıyorsanız (sadece IP ile erişim) 3000 ve 8000’i de açın:

```bash
ufw allow 3000
ufw allow 8000
```

---

## 8. Güncelleme ve Yeniden Başlatma

Kod güncelledikten sonra:

```bash
cd /root/metaadsmanager
git pull   # veya rsync ile tekrar dosya atın
export NEXT_PUBLIC_API_URL=https://yourdomain.com
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

Sadece backend/frontend’i yeniden başlatmak:

```bash
docker compose -f docker-compose.prod.yml restart backend frontend
```

---

## 9. Sorun Giderme

- **502 Bad Gateway:** Backend veya frontend container çalışmıyor olabilir. `docker compose -f docker-compose.prod.yml ps` ve `logs backend` / `logs frontend` kontrol edin.
- **CORS hatası:** `CORS_ORIGINS` ve `NEXT_PUBLIC_API_URL`’in kullandığınız domain/URL ile birebir eşleştiğinden emin olun (https/http, www olan/olmayan).
- **Veritabanı:** Şifreyi değiştirdiyseniz hem `backend/.env` hem de `docker-compose.prod.yml` içindeki `POSTGRES_*` ile uyumlu olmalı; prod compose bu env’leri kullanır.
- **Webhook (Meta):** Meta’da webhook URL’i `https://yourdomain.com/api/webhooks/meta` ve doğrulama token’ı `META_WEBHOOK_VERIFY_TOKEN` ile aynı olmalı.

---

## 10. Özet Checklist

- [ ] Hetzner’da Ubuntu sunucu oluşturuldu
- [ ] Docker ve Docker Compose kuruldu
- [ ] Proje sunucuya clone/rsync edildi
- [ ] `backend/.env` oluşturuldu; `ENVIRONMENT=production`, `CORS_ORIGINS`, `NEXT_PUBLIC_API_URL`, Meta token ve webhook ayarları yapıldı
- [ ] `docker compose -f docker-compose.prod.yml up -d` ile servisler ayağa kalktı
- [ ] (İsteğe bağlı) Domain A kaydı, Nginx ve Let’s Encrypt ile HTTPS açıldı
- [ ] Firewall (ufw) ayarlandı

Bu adımlarla proje Hetzner üzerinde yayında olur.
