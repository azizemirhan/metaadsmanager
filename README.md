# 📊 Meta Ads Dashboard

**Next.js + FastAPI** tabanlı, AI destekli Meta Ads yönetim ve raporlama platformu.

---

## Ozellikler

- **Canli Dashboard** — Kampanya, gosterim, tiklama, CTR, CPC, CPM, ROAS metrikleri
- **Interaktif Grafikler** — Gunluk trend, harcama dagilimi, kampanya karsilastirmasi
- **Gelismis Analitik** — Metrik secici, kampanya karsilastirma grafigi, coklu trend goruntuleme
- **AI Analiz (Claude/Gemini)** — Otomatik kampanya degerlendirmesi ve somut oneriler
- **Rapor Turleri** — Haftalik ozet, kampanya karsilastirma, performans trendi (HTML/CSV)
- **E-posta Raporlama** — AI raporu + CSV eki ile otomatik e-posta gonderim
- **Kampanya Yonetimi** — Filtreleme, siralama, durum takibi
- **Coklu Hesap Destegi** — Birden fazla Meta reklam hesabi arasinda gecis
- **Kalici Ayarlar** — API anahtarlari ve yapilandirma backend'de saklanir
- **Rate Limiting** — IP bazli istek sinirlamasi (varsayilan: 60 istek/dakika)
- **Health Check** — `/health` endpoint'i ile izleme destegi

---

## 🚀 Kurulum

### 1. Projeyi Klonlayın

```bash
git clone https://github.com/sizin-repo/meta-ads-dashboard.git
cd meta-ads-dashboard
```

### 2. .env Dosyasını Oluşturun

```bash
cp .env.example backend/.env
```

Ardından `backend/.env` dosyasını açıp aşağıdaki bilgileri doldurun (nasıl alınacağı bir sonraki bölümde).

#### Ortam Degiskenleri

| Degisken | Aciklama | Varsayilan |
|----------|----------|------------|
| `ENVIRONMENT` | `development` veya `production` | `development` |
| `CORS_ORIGINS` | Virgul ile ayrilmis izinli frontend URL'leri | `http://localhost:3000,...` |
| `RATE_LIMIT_REQUESTS` | Pencere basina max istek sayisi | `60` |
| `RATE_LIMIT_WINDOW` | Rate limit pencere suresi (saniye) | `60` |

> **Production Notu:** `ENVIRONMENT=production` ayarlandiginda API hata cevaplarinda detay gizlenir, sadece sunucu loglarinda gorunur.

### 3a. Docker ile Başlatın (Önerilen)

```bash
docker-compose up --build
```

### 3b. Manuel Kurulum

**Backend (sanal ortam önerilir):**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Venv kullanmadan:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 4. Açın

- Dashboard: http://localhost:3000 (veya Next.js farklı port kullanıyorsa örn. http://localhost:3001)
- API Docs: http://localhost:8000/docs

---

## 🔑 Meta API Erişimi Nasıl Alınır?

### Adım 1: Meta Developer Hesabı Açın
1. https://developers.facebook.com adresine gidin
2. Sağ üstten **"Get Started"** → Facebook hesabınızla giriş yapın
3. **Phone number doğrulaması** yapın

### Adım 2: Uygulama Oluşturun
1. **My Apps → Create App** tıklayın
2. App type: **Business** seçin
3. Uygulama adı verin (örn: "Reklam Dashboard")
4. Business hesabınızı bağlayın
5. **Create App** tıklayın

### Adım 3: App ID ve App Secret Alın
- Oluşturulan uygulamanın **Settings → Basic** sayfasında:
  - `App ID` → `.env` dosyasına ekleyin
  - `App Secret` → `.env` dosyasına ekleyin

### Adım 4: Access Token Alın
1. Sol menüden **Tools → Graph API Explorer** açın
2. Sağ üstten uygulamanızı seçin
3. **Generate Access Token** tıklayın
4. Şu izinleri verin:
   - ✅ `ads_read`
   - ✅ `ads_management`
   - ✅ `business_management`
5. Oluşan token'ı kopyalayın → `.env` dosyasına ekleyin

> ⚠️ **Kısa süreli token:** Graph API Explorer'dan alınan token 1 saat geçerlidir.
> Uzun süreli token için: https://developers.facebook.com/tools/accesstoken/
> veya System User Token kullanın (Business Manager → System Users)

### Adım 5: Ad Account ID Bulun
1. Business Manager'a gidin: https://business.facebook.com
2. Sol menü → **Ad Accounts** tıklayın
3. Hesabınızın ID'sini kopyalayın (başında `act_` var)
4. `.env` dosyasına ekleyin: `META_AD_ACCOUNT_ID=act_123456789`

---

## 🔑 AI Analiz: Claude veya Gemini

Analiz için **Claude** (Anthropic) veya **Gemini** (Google) kullanabilirsiniz. `backend/.env` içinde birini ayarlayın.

### Seçenek A — Gemini (önerilen, ücretsiz kota)

1. https://aistudio.google.com/apikey adresine gidin
2. Google hesabınızla giriş yapın
3. **Create API Key** → key'i kopyalayın
4. `backend/.env` dosyasına ekleyin:
   ```
   GEMINI_API_KEY=AIza...
   AI_PROVIDER=gemini
   ```
   (Sadece `GEMINI_API_KEY` doluysa varsayılan zaten Gemini kullanılır.)

### Seçenek B — Claude (Anthropic)

1. https://console.anthropic.com adresine gidin
2. **API Keys → Create Key** tıklayın
3. Key'i `backend/.env` dosyasına ekleyin:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   AI_PROVIDER=claude
   ```

---

## 📧 Gmail SMTP Kurulumu

1. Google Hesap → Güvenlik → 2 Adımlı Doğrulama açın
2. Güvenlik → **Uygulama Şifreleri** → "Diğer" seçin, isim verin
3. Oluşan 16 haneli şifreyi kopyalayın
4. `.env` dosyasına:
   ```
   SMTP_USER=hesabiniz@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx
   ```

---

## 📁 Proje Yapısı

```
meta-ads-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── routers/
│   │   │   ├── campaigns.py     # Kampanya endpoint'leri
│   │   │   ├── reports.py       # CSV export
│   │   │   ├── ai_analysis.py   # AI analiz endpoint'leri
│   │   │   └── email_reports.py # E-posta gönderim
│   │   └── services/
│   │       ├── meta_service.py  # Meta Marketing API
│   │       ├── ai_service.py    # Claude AI entegrasyonu
│   │       └── email_service.py # SMTP e-posta
│   ├── requirements.txt
│   └── .env                     # 🔒 Gizli anahtarlar (git'e eklemeyin!)
│
├── frontend/
│   └── src/app/
│       ├── page.tsx             # Ana dashboard
│       ├── campaigns/page.tsx   # Kampanya listesi
│       ├── ai-insights/page.tsx # AI analiz sayfası
│       ├── settings/page.tsx    # API ayarları
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   └── MetricCard.tsx
│       └── lib/api.ts           # API client
│
└── docker-compose.yml
```

---

## API Endpoint'leri

| Endpoint | Aciklama |
|----------|----------|
| `GET /api/campaigns` | Tum kampanyalar + metrikler (`?ad_account_id=` destekli) |
| `GET /api/campaigns/summary` | Hesap ozeti (`?ad_account_id=` destekli) |
| `GET /api/campaigns/daily` | Gunluk breakdown (`?ad_account_id=` destekli) |
| `GET /api/campaigns/accounts` | Erisilen reklam hesaplarini listele |
| `GET /api/reports/export/csv` | CSV export (campaigns/ads/adsets/daily) |
| `GET /api/reports/export/html` | HTML rapor export (weekly_summary/campaign_comparison/performance_trend) |
| `GET /api/ai/analyze` | Tum kampanya AI analizi |
| `GET /api/ai/analyze/{id}` | Tek kampanya analizi |
| `POST /api/email/send-report` | E-posta raporu gonder |
| `GET /api/settings` | Mevcut ayarlar (hassas degerler maskeli) |
| `PUT /api/settings` | Ayarlari guncelle ve kaydet |
| `GET /health` | Health check (izleme/load balancer icin) |

---

## Production Checklist

Production ortamina deploy etmeden once:

1. **Ortam degiskenleri:**
   ```env
   ENVIRONMENT=production
   CORS_ORIGINS=https://your-domain.com
   RATE_LIMIT_REQUESTS=60
   RATE_LIMIT_WINDOW=60
   ```

2. **Meta API token:**
   - Graph API Explorer token'i yerine **System User Token** kullanin (Business Manager -> System Users)
   - System User token'lari suresi dolmaz

3. **HTTPS:**
   - Frontend ve backend'i HTTPS uzerinden sunun
   - Reverse proxy (nginx/caddy) ile SSL terminate edin

4. **Ayarlar dosyasi:**
   - `backend/settings.json` dosyasi hassas bilgi icerir, guvenli tutun
   - Alternatif: sadece `.env` dosyasi kullanin, settings UI'yi devre disi birakin

5. **Health check:**
   - `/health` endpoint'ini load balancer veya uptime izleme araci ile kullanin

6. **Rate limiting:**
   - Varsayilan: IP basina 60 istek/dakika
   - `RATE_LIMIT_REQUESTS` ve `RATE_LIMIT_WINDOW` ile ayarlanabilir

7. **Loglama:**
   - Production'da hata detaylari loglanir ama API yaniti gizli tutulur
   - Uvicorn'u `--log-level warning` ile calistirin

---

## Guvenlik Notlari

- `.env` ve `settings.json` dosyalarini asla git'e pushlamayin (`.gitignore`'da zaten var)
- Production'da uzun sureli System User Token kullanin
- Meta API rate limit: 200 req/saat, asmamaya dikkat edin
- Hassas ayarlar API yanitinda maskelenir (son 4 karakter gosterilir)

---

## Lisans

MIT
