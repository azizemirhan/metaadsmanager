# 📊 Meta Ads Dashboard

**Next.js + FastAPI** tabanlı, AI destekli Meta Ads yönetim ve raporlama platformu.

---

## ✨ Özellikler

### Çekirdek Özellikler
- 📈 **Canlı Dashboard** — Kampanya, gösterim, tıklama, CTR, CPC, CPM, ROAS metrikleri
- 📊 **İnteraktif Grafikler** — Günlük trend, harcama dağılımı, kampanya karşılaştırması
- 🤖 **AI Analiz (Claude)** — Otomatik kampanya değerlendirmesi ve somut öneriler
- ⬇️ **CSV Export** — Kampanya, reklam seti ve reklam verilerini indirin
- 📧 **E-posta Raporlama** — Haftalık AI raporu otomatik e-posta ile gönderim
- 💬 **WhatsApp Bot** — Otomatik rapor ve uyarı bildirimleri
- 🔍 **Kampanya Yönetimi** — Filtreleme, sıralama, durum takibi

### ⚡ Faz 1 - Yeni Özellikler (2024)
- ⚡ **Redis Caching** — API yanıt süresi %80'e varan iyileştirme (5dk cache)
- 🔔 **Slack Entegrasyonu** — Kampanya değişikliklerinde anlık Slack bildirimleri
- 🌙 **Dark Mode** — Göz yorgunluğunu azaltan koyu tema
- 🧪 **Test Coverage** — Kapsamlı unit ve integration test altyapısı

---s

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

#### Ortam Değişkenleri

| Değişken | Açıklama | Varsayılan |
|----------|----------|------------|
| `ENVIRONMENT` | Çalışma ortamı: `development` veya `production` | `development` |
| `CORS_ORIGINS` | Virgülle ayrılmış izinli frontend URL'leri | `http://localhost:3000,...` |

> 💡 **Production Notu:** `ENVIRONMENT=production` ayarlandığında API hata cevaplarında detay gizlenir, sadece sunucu loglarında görünür.

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

## 💬 WhatsApp Business API Kurulumu (Opsiyonel)

Rapor ve uyarıları WhatsApp üzerinden göndermek için:

### Adım 1: Meta Business Manager'da WhatsApp Ekleme

1. https://business.facebook.com adresine gidin
2. **Hesap Ayarları → WhatsApp Accounts** tıklayın
3. **Add WhatsApp Account** ile yeni hesap oluşturun
4. Telefon numaranızı doğrulayın (SMS veya arama ile)

### Adım 2: WhatsApp Cloud API Erişimi

1. Meta Developers → Uygulamanız → **Add Product**
2. **WhatsApp** ürününü ekleyin
3. **API Setup** sayfasında:
   - Phone Number ID'yi kopyalayın → `WHATSAPP_PHONE_ID`
   - Access Token oluşturun (veya mevcut META_ACCESS_TOKEN kullanın)

### Adım 3: Gerekli İzinler

Graph API Explorer veya token oluştururken şu izinleri ekleyin:
- ✅ `whatsapp_business_management`
- ✅ `whatsapp_business_messaging`

### Adım 4: .env Ayarları

```bash
WHATSAPP_PHONE_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAA...        # Opsiyonel, boşsa META_ACCESS_TOKEN kullanılır
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...   # Bot webhook için güvenli token
```

### Özellikler

- **Rapor Gönderimi:** Raporlar ve AI Insights sayfalarından WhatsApp'a rapor gönderme
- **Bot Komutları:** 
  - "Bugün" → Günlük özet
  - "7 gün" / "30 gün" → Haftalık/aylık rapor
  - "Kampanyalar" → Aktif kampanya listesi
  - "En iyi 5" → En çok harcama yapan kampanyalar
- **Webhook:** `POST /api/whatsapp/webhook` endpoint'i gelen mesajları işler

**Not:** WhatsApp Cloud API ilk başta "Sandbox" modda çalışır; sadece kayıtlı test numaralarına mesaj gönderebilirsiniz. Production kullanımı için Meta onayı gerekir.

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

## 📊 API Endpoint'leri

| Endpoint | Açıklama |
|----------|----------|
| `GET /api/campaigns` | Tüm kampanyalar + metrikler (`?ad_account_id=act_xxx` opsiyonel) |
| `GET /api/campaigns/accounts` | Kullanılabilir reklam hesapları listesi |
| `GET /api/campaigns/summary` | Hesap özeti |
| `GET /api/campaigns/daily` | Günlük breakdown |
| `GET /api/settings` | Kayıtlı ayarlar (hassas alanlar maskeli) |
| `PUT /api/settings` | Ayarları kaydet |
| `GET /api/reports/export/csv` | CSV export |
| `GET /api/ai/analyze` | Tüm kampanya AI analizi |
| `GET /api/ai/analyze/{id}` | Tek kampanya analizi |
| `POST /api/email/send-report` | E-posta raporu gönder |
| `POST /api/whatsapp/send-report` | WhatsApp'a rapor gönder |
| `POST /api/whatsapp/send-daily-summary` | Günlük özet gönder |
| `POST /api/whatsapp/send-alert` | Uyarı/alert mesajı gönder |
| `GET/POST /api/whatsapp/webhook` | WhatsApp webhook (bot mesajları) |

---

## 🚀 Production Checklist

- **ENVIRONMENT:** `ENVIRONMENT=production` ayarlayın; hata detayları kullanıcıya gitmez.
- **CORS:** `CORS_ORIGINS=https://yourdomain.com` (virgülle birden fazla origin).
- **Token:** Uzun süreli / System User token kullanın; Graph API Explorer token'ı kısa sürelidir.
- **HTTPS:** API ve frontend'i HTTPS ile yayınlayın.
- **Rate limit:** Production'da IP başına dakikada 120 istek sınırı uygulanır (429 döner).
- **Ayarlar:** Panelden Ayarlar ile kaydedilen değerler `backend/settings.json` içinde saklanır; bu dosyayı git'e eklemeyin.

---

## 🛡️ Güvenlik Notları

- `.env` ve `backend/settings.json` dosyalarını asla git'e pushlamayın — `.gitignore`'da olmalı
- Production'da uzun süreli System User Token kullanın
- API rate limit: Meta 200 req/saat, aşmamaya dikkat edin

---

## 🧪 Test

Projede kapsamlı test altyapısı mevcuttur.

### Backend Testleri

```bash
cd backend

# Geliştirme bağımlılıklarını kur
pip install -r requirements-dev.txt

# Tüm testleri çalıştır
pytest

# Sadece unit testler
pytest -m unit

# Sadece integration testler
pytest -m integration

# Coverage raporu ile
pytest --cov=app --cov-report=html --cov-report=term-missing

# Belirli bir test dosyası
pytest app/tests/unit/test_auth.py -v
```

### Frontend Testleri

```bash
cd frontend

# Test bağımlılıklarını kur
npm install

# Testleri çalıştır
npm run test

# Watch modunda
npm run test:watch

# Coverage raporu ile
npm run test:coverage
```

### Test Ortamı Kurulumu

Testler için yerel PostgreSQL gereklidir:

```bash
# Test veritabanını oluştur
createdb metaads_test

# Test ortamı değişkenleri
export DATABASE_URL=postgresql+asyncpg://metaads:metaads@localhost:5432/metaads_test
export JWT_SECRET=test-secret-key
export ENVIRONMENT=testing
```

---

## 📝 Lisans

MIT
