# Meta Ads Dashboard — Yazılım Özellikleri ve Mimari

Bu belge, mevcut durumun özeti, eksik/yetersiz kısımların tamamlanmış hali ve hedef mimariyi tanımlar.

---

## 1. Genel Bakış

**Meta Ads Dashboard**, Meta (Facebook & Instagram) reklam hesaplarının tek bir arayüzden izlenmesi, raporlanması ve AI destekli analizi için tasarlanmış tam stack bir uygulamadır.

| Özellik | Açıklama |
|--------|----------|
| **Hedef kitle** | Küçük/orta işletmeler, ajanslar, tek reklam yöneticisi |
| **Dil** | Türkçe (UI + AI çıktıları) |
| **Para birimi** | TL (özelleştirilebilir hedef) |
| **Stack** | Next.js 14, FastAPI, Meta Marketing API, Claude (Anthropic) |

---

## 2. Mevcut Durum vs Hedef Durum

### 2.1 Özet Tablo

| Alan | Mevcut | Hedef |
|------|--------|--------|
| Dashboard (KPI + grafik) | ✅ Var | ✅ Aynı, küçük iyileştirmeler |
| Kampanya listesi | ✅ Var | ✅ Aynı |
| AI analiz (toplu/tek) | ✅ Var | ✅ + async AI çağrıları |
| E-posta raporu | ✅ Var | ✅ Aynı |
| CSV export | ✅ Var | ✅ Aynı |
| Analitik sayfası | ❌ 404 | ✅ Gelişmiş grafikler + karşılaştırma |
| Raporlar sayfası | ❌ 404 | ✅ Rapor şablonları + zamanlı rapor |
| Ayarlar (kalıcı) | ❌ Sadece UI | ✅ Backend ile kayıt / .env proxy |
| Çoklu hesap | ❌ Yok | ✅ Hesap seçici + çoklu Ad Account |
| CORS / production | ❌ Sadece localhost | ✅ Ortam bazlı CORS |
| Reklam yönetimi | ❌ Yok | ✅ Üst seviye: kampanya duraklat/devam, bütçe güncelleme, **panelden reklam oluşturma ve yayınlama** |
| AI tahmin / öneriyi uygulama | ❌ Sadece metin | ✅ Üst seviye: tahmin kartları, uyarılar, öneri listesi, “Uygula” ile bütçe/duraklat |
| Hata yönetimi | ⚠️ Detay sızıntısı | ✅ Genel mesaj + log |

---

## 3. Özellik Listesi (Hedef)

### 3.1 Çekirdek Özellikler (Mevcut + Küçük Tamamlamalar)

- **Genel bakış (Dashboard)**
  - Hesap özeti KPI’ları (harcama, gösterim, tıklama, CTR, CPC, CPM, aktif kampanya sayısı).
  - Periyot seçici: 7 / 14 / 30 / 90 gün.
  - Günlük harcama ve tıklama trendi (alan grafiği).
  - Hedefe göre harcama dağılımı (pasta grafik).
  - En çok harcama yapan kampanyalar tablosu ve bar grafik.
  - Kampanya verisi CSV export.

- **Kampanyalar**
  - Kampanya listesi (Meta API’den).
  - Arama, durum filtresi (Tümü / Aktif / Duraklatıldı / Arşivlenmiş).
  - Sütun bazlı sıralama (harcama, gösterim, tıklama, CTR, CPC, CPM, ROAS, frequency, dönüşüm).
  - Kampanya detayında reklam seti ve reklam listesi (mevcut API kullanılarak).

- **AI Analiz**
  - Tüm kampanyalar için toplu analiz (Claude).
  - Tek kampanya için detaylı analiz.
  - Analiz sonuçlarının Türkçe, yapılandırılmış formatta sunulması (genel değerlendirme, güçlü yönler, dikkat edilecekler, öneriler, bütçe tavsiyesi).
  - AI çağrılarının async yapılması (backend’in bloklanmaması).

- **Raporlama**
  - CSV export: kampanyalar, reklam setleri, reklamlar (tip ve periyot seçilebilir).
  - Haftalık e-posta raporu: AI özeti + HTML gövde + opsiyonel CSV eki.
  - Gönderim adresi ve periyot (örn. son 7 gün) seçilebilir.

### 3.2 Eksiklerin Tamamlanması ile Gelen Özellikler

- **Analitik sayfası** (`/analytics`)
  - Karşılaştırmalı grafikler: kampanyalar arası harcama, CTR, ROAS.
  - Zaman dilimine göre (günlük/haftalık) performans trendi.
  - Metrik seçici (harcama, tıklama, CTR, CPC, CPM, ROAS).
  - İsteğe bağlı: hedef kitle / yer segmentasyonu (Meta API’de varsa).

- **Raporlar sayfası** (`/reports`)
  - Hazır rapor türleri: Haftalık özet, Kampanya karşılaştırma, Performans trendi.
  - Periyot ve format seçimi (PDF hedef için not: önce HTML/CSV, PDF sonra eklenebilir).
  - “Raporu indir” ve “E-posta ile gönder” aksiyonları.
  - İsteğe bağlı: Zamanlanmış rapor (cron + kuyruk) ile belirli e-posta listesine otomatik gönderim.

- **Ayarlar (kalıcı yapılandırma)**
  - Meta: Access Token, Ad Account ID, (opsiyonel) App ID / App Secret.
  - Anthropic: API Key.
  - SMTP: Host, port, kullanıcı, şifre.
  - Seçenek A: Değerler backend’de şifreli saklanır; frontend sadece “kaydet/test” isteği gönderir (production için tercih).
  - Seçenek B: Backend `.env` dosyasını okumaz; “Ayarlar” sadece dokümantasyon ve “.env’i şu şekilde güncelle” rehberi olur; kalıcılık sunucu yöneticisi tarafından sağlanır (mevcut davranışa yakın).

- **Çoklu reklam hesabı**
  - Kullanıcı başına veya global “bağlı hesaplar” listesi (Ad Account ID + isim).
  - UI’da hesap seçici (dropdown); seçilen hesaba göre tüm veri istekleri o hesaba yapılır.
  - Backend: `META_AD_ACCOUNT_ID` yerine istek bazlı veya oturum bazlı `ad_account_id` kullanımı; token’ın ilgili hesaplara erişimi olmalı.

- **Production ve güvenlik**
  - CORS: `NEXT_PUBLIC_APP_URL` / ortam değişkenine göre izin verilen origin listesi.
  - Hata cevapları: Production’da genel mesaj (`Bir hata oluştu`); detay sadece loglarda.
  - Rate limit: Meta API ve kendi API’niz için istek sınırları (örn. dakikada X istek).
  - Token: Uzun süreli / System User token kullanımı dokümante edilir; isteğe bağlı token yenileme akışı.

### 3.3 Üst Seviye (Next Level) — Sadece Meta

Bu özellikler ** [NEXT_LEVEL_FEATURES.md](./NEXT_LEVEL_FEATURES.md) ** belgesinde detaylı tanımlıdır; uygulama fazları ** [IMPLEMENTATION_PHASES.md](./IMPLEMENTATION_PHASES.md) ** içinde Faz 7 ve Faz 8’dir.

- **AI tahmin ve panelden uygulanabilir öneriler**
  - Tahmin: harcama tahmini, bütçe senaryosu, ROAS tahmini (panelde kart/liste).
  - Anomali/uyarılar: harcama/CTR/ROAS sapması; “Duraklat”, “Bütçe düşür”, “Kampanyaya git” aksiyonları.
  - AI öneri listesi: bütçe artır/düşür, kampanya duraklat/başlat, yeni kreatif önerisi; her biri için “Uygula” ile Meta API üzerinden güncelleme.
- **Panelden reklam oluşturma ve yayınlama**
  - Sihirbaz: Kampanya (veya mevcut seç) → Reklam seti (bütçe, hedef kitle, yerleşimler) → Kreatif (görsel/video yükleme, metin, CTA, link) → Reklam.
  - Medya yükleme panelden; backend Meta’ya image/video upload + ad creative + ad create.
  - “Yayınla” ile status = ACTIVE; reklam Meta’da canlıya alınır.
- **Otomasyon (Meta odaklı):** Uyarı kuralları, otomatik duraklatma, bütçe tavanı, zamanlanmış raporlar.

### 3.4 Opsiyonel (İleride)

- **Bildirimler:** Belirli eşikler (örn. bütçe aşımı, CTR düşüşü) için e-posta/uygulama içi uyarı.
- **Rol / yetki:** Admin vs görüntüleyici; hesap bazlı yetkilendirme.
- **PDF export:** Raporlar sayfasından PDF indirme.
- **Çoklu dil / çoklu para birimi:** Arayüz dili ve para birimi seçeneği.

---

## 4. Mimari

### 4.1 Yüksek Seviye

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js 14)                           │
│  App Router · React Query · Recharts · Tailwind · TypeScript            │
└─────────────────────────────────┬─────────────────────────────────────┘
                                  │ REST (JSON + CSV)
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                               │
│  Routers: campaigns · reports · ai_analysis · email_reports · settings   │
│  Services: meta_service · ai_service · email_service · settings_service │
└─────┬─────────────────────┬─────────────────────┬─────────────────────┘
      │                     │                     │
      ▼                     ▼                     ▼
┌───────────┐         ┌───────────┐         ┌───────────┐
│ Meta      │         │ Anthropic │         │ SMTP      │
│ Graph API │         │ (Claude)  │         │ (e-posta) │
│ v21.0     │         │           │         │           │
└───────────┘         └───────────┘         └───────────┘
```

### 4.2 Backend Mimari (Hedef)

```
backend/
├── app/
│   ├── main.py                 # FastAPI, CORS, middleware, router mount
│   ├── config.py               # Ortam değişkenleri, CORS origins, production bayrağı
│   ├── routers/
│   │   ├── campaigns.py        # Kampanya, özet, günlük, ad set, reklam
│   │   ├── reports.py         # CSV export, (ileride) rapor şablonları
│   │   ├── ai_analysis.py      # Toplu / tek kampanya AI analizi
│   │   ├── email_reports.py   # Haftalık e-posta raporu
│   │   ├── settings.py        # [Yeni] Ayarlar CRUD veya proxy
│   │   └── analytics.py       # [Yeni] Karşılaştırmalı metrik endpoint’leri
│   ├── services/
│   │   ├── meta_service.py    # Meta API client (hesap parametreli)
│   │   ├── ai_service.py       # Claude async çağrıları
│   │   ├── email_service.py   # SMTP rapor gönderimi
│   │   └── settings_service.py# [Yeni] Ayarlar okuma/yazma (veya .env rehberi)
│   └── models/                # [Opsiyonel] Pydantic request/response modelleri
├── requirements.txt
├── Dockerfile
└── .env
```

- **Hesap seçimi:** İstekte `ad_account_id` (query/body/header) veya oturumdan; `meta_service` bu ID ile çağrı yapar.
- **AI:** `ai_service` içinde `asyncio.to_thread` veya async Anthropic client ile bloklamayan çağrı.
- **Hata:** Production’da `HTTPException(detail="Bir hata oluştu")`; gerçek sebep sadece log’a yazılır.

### 4.3 Frontend Mimari (Hedef)

```
frontend/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Dashboard
│   ├── globals.css
│   ├── campaigns/
│   │   └── page.tsx
│   ├── analytics/                  # [Yeni] Analitik sayfası
│   │   └── page.tsx
│   ├── reports/                    # [Yeni] Raporlar sayfası
│   │   └── page.tsx
│   ├── ai-insights/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx                # Backend’e bağlı ayar formu veya rehber
│   ├── components/
│   │   ├── Sidebar.tsx             # /analytics, /reports linkleri çalışır
│   │   ├── MetricCard.tsx
│   │   ├── Providers.tsx
│   │   └── AccountSwitcher.tsx     # [Yeni] Çoklu hesap seçici
│   └── lib/
│       ├── api.ts                  # Tüm API çağrıları + tipler
│       └── env.ts                  # [Opsiyonel] NEXT_PUBLIC_* tek yerde
└── ...
```

- **Sidebar:** `/analytics` ve `/reports` gerçek sayfalara yönlendirilir.
- **Ayarlar:** Backend’de ayar endpoint’i varsa form submit ile kayıt; yoksa “.env nasıl düzenlenir” rehberi + form placeholder.
- **Hesap seçici:** Context veya URL query ile seçilen `ad_account_id`; `api.ts` tüm ilgili isteklere bu parametreyi ekler.

### 4.4 Veri Akışı (Örnek)

1. **Dashboard:** Frontend `GET /api/campaigns/summary?days=30` ve `GET /api/campaigns/daily?days=30` çağırır; backend Meta API’den veriyi alır, JSON döner; frontend grafikleri çizer.
2. **AI analiz:** Frontend `GET /api/ai/analyze?days=30` çağırır; backend kampanyaları çeker, Claude’a async gönderir, yanıtı işleyip metin döner.
3. **E-posta raporu:** Frontend `POST /api/email/send-report` ile alıcı ve periyot gönderir; backend veri + AI metnini üretir, HTML + CSV ekini SMTP ile gönderir.
4. **Çoklu hesap (hedef):** Frontend isteklerde `ad_account_id=act_xxx` gönderir; backend `meta_service`’i bu ID ile kullanır.

### 4.5 Ortam ve Konfigürasyon

| Değişken | Açıklama | Örnek |
|----------|----------|--------|
| `META_ACCESS_TOKEN` | Meta API token | EAAxxx... |
| `META_AD_ACCOUNT_ID` | Varsayılan reklam hesabı | act_123456789 |
| `ANTHROPIC_API_KEY` | Claude API anahtarı | sk-ant-... |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | E-posta | smtp.gmail.com, 587, ... |
| `NEXT_PUBLIC_API_URL` | Frontend’in kullandığı API adresi | http://localhost:8000 |
| `CORS_ORIGINS` / `ALLOWED_ORIGINS` | Backend izin verilen origin | http://localhost:3000,https://app.example.com |
| `ENVIRONMENT` | production / development | production |

---

## 5. Eksik ve Yetersiz Kısımların Tamamlama Özeti

| # | Eksik / yetersiz | Tamamlama |
|---|-------------------|-----------|
| 1 | Analitik sayfası yok (404) | `/analytics` route’u aç; karşılaştırmalı grafikler ve metrik seçici ekle; gerekirse `GET /api/analytics/...` endpoint’leri ekle. |
| 2 | Raporlar sayfası yok (404) | `/reports` route’u aç; rapor türü ve periyot seçimi, “İndir” / “E-posta ile gönder” butonları. |
| 3 | Ayarlar kalıcı değil | Backend’de ayarları okuyup yazan endpoint (veya sadece dokümantasyon); frontend’de formu buna bağla veya .env rehberi göster. |
| 4 | Çoklu hesap yok | Backend’de istek bazlı `ad_account_id`; frontend’de hesap listesi + seçici; API çağrılarına parametre ekle. |
| 5 | CORS sadece localhost | `config` ile `CORS_ORIGINS` kullan; production’da gerçek domain’i ekle. |
| 6 | AI senkron, blokluyor | Anthropic çağrılarını `asyncio.to_thread` veya async client ile yap. |
| 7 | Hata detayı production’da | Production’da `detail` sabit mesaj; gerçek hata sadece log. |
| 8 | Reklam yönetimi yok | Opsiyonel: Meta API’de ilgili izinlerle kampanya/reklam durumu ve bütçe güncelleme endpoint’leri. |

---

## 6. Güvenlik ve Operasyon

- **Gizlilik:** `.env` ve API anahtarları versiyon kontrolüne alınmaz; production’da güvenli secret yönetimi kullanılır.
- **Meta token:** Uzun süreli veya System User token kullanımı önerilir; süre ve yetkiler dokümante edilir.
- **Rate limit:** Meta API limitleri (örn. 200/saat) aşılmamalı; gerekirse backend’de basit throttling eklenir.
- **E-posta:** SMTP şifresi ve API anahtarları sadece backend’de tutulur; frontend’e gönderilmez.

---

## 7. Fazlı Uygulama Planı

Yapılacakların faz faz detayı ve kabul kriterleri için ** [IMPLEMENTATION_PHASES.md](./IMPLEMENTATION_PHASES.md) ** dosyasına bakın. Özet:

- **Faz 1:** Eksik sayfalar (placeholder), CORS, hata yönetimi, async AI
- **Faz 2:** Analitik sayfası (karşılaştırmalı grafikler)
- **Faz 3:** Raporlar sayfası (indir / e-posta gönder)
- **Faz 4:** Ayarlar (rehber veya kalıcı backend)
- **Faz 5:** Çoklu hesap (hesap seçici + API parametresi)
- **Faz 6:** Production & güvenlik (rate limit, dokümantasyon)
- **Faz 7:** AI tahmin + panelden uygulanabilir öneriler (tahmin kartları, uyarılar, “Uygula” aksiyonları)
- **Faz 8:** Panelden reklam oluşturma ve yayınlama (kampanya → reklam seti → kreatif + reklam sihirbazı, “Yayınla”)

Üst seviye özellik detayı: ** [NEXT_LEVEL_FEATURES.md](./NEXT_LEVEL_FEATURES.md) **. Puan ve sektör karşılaştırması: ** [RATING_AND_COMPETITORS.md](./RATING_AND_COMPETITORS.md) **.

---

## 8. Doküman Sürümü

| Tarih | Açıklama |
|-------|----------|
| 1.0 | İlk sürüm: mevcut durum, hedef özellikler, mimari, eksiklerin tamamlama özeti. |
| 1.1 | Fazlı uygulama planı referansı eklendi (IMPLEMENTATION_PHASES.md). |
| 1.2 | Üst seviye (Next Level) özellikler eklendi: AI tahmin + panelden uygulanabilir öneriler, panelden reklam oluşturma/yayınlama. Faz 7–8, NEXT_LEVEL_FEATURES.md ve RATING_AND_COMPETITORS.md referansları. |

Bu belge, geliştirme planı ve mimari referansı olarak kullanılabilir. Yeni özellik veya değişiklikler bu MD dosyasına işlenerek tutarlılık sağlanabilir.
