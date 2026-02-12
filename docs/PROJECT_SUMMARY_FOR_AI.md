# Meta Ads Dashboard — Yapay Zekâ İçin Proje Özeti

Bu belge, projeyi bir yapay zekâya tanıtmak veya bağlam vermek için kullanılır. Kopyalayıp yapıştırabilirsiniz.

---

## 1. Proje Nedir?

**Meta Ads Dashboard**, Meta (Facebook & Instagram) reklam hesaplarını tek arayüzden izleyen, raporlayan ve AI ile analiz eden **tam stack** bir uygulamadır. Hedef kitle: küçük/orta işletmeler, ajanslar. Arayüz ve AI çıktıları **Türkçe**, para birimi **TL**.

---

## 2. Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | Next.js 14 (App Router), React, TypeScript, Tailwind CSS, TanStack Query, Recharts |
| **Backend** | FastAPI (Python 3), Uvicorn |
| **Dış API’ler** | Meta Marketing API (Graph API), Claude (Anthropic) veya Gemini (Google) |
| **Opsiyonel** | Gmail SMTP (e-posta raporu), Docker / docker-compose |

---

## 3. Proje Yapısı (Özet)

```
meta-ads-dashboard/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI uygulaması, CORS, router mount
│   │   ├── routers/
│   │   │   ├── campaigns.py        # Kampanya listesi, özet, günlük breakdown
│   │   │   ├── reports.py          # CSV export
│   │   │   ├── ai_analysis.py      # AI analiz (toplu / tek kampanya)
│   │   │   └── email_reports.py    # E-posta raporu gönderimi
│   │   └── services/
│   │       ├── meta_service.py     # Meta Marketing API çağrıları
│   │       ├── ai_service.py      # Claude / Gemini entegrasyonu
│   │       └── email_service.py    # SMTP e-posta
│   ├── requirements.txt
│   └── .env                        # Gizli anahtarlar (git’e eklenmez)
│
├── frontend/
│   └── src/app/
│       ├── page.tsx                # Ana dashboard (KPI, grafikler, kampanya tablosu)
│       ├── campaigns/page.tsx      # Kampanya listesi (filtre, sıralama, CSV export)
│       ├── analytics/page.tsx      # Analitik sayfası (günlük trend, özet)
│       ├── reports/page.tsx        # Raporlar sayfası (placeholder / temel)
│       ├── ai-insights/page.tsx    # AI analiz sayfası
│       ├── settings/page.tsx       # Ayarlar (UI; kalıcı backend kaydı yok)
│       ├── components/             # Sidebar, MetricCard, Providers
│       └── lib/api.ts              # Backend API client (fetch)
│
├── docs/                           # Mimari, fazlar, rakip analizi
├── .env.example                    # Örnek env (root)
└── docker-compose.yml
```

---

## 4. Önemli Özellikler (Mevcut)

- **Dashboard:** Hesap özeti (harcama, gösterim, tıklama, CTR, CPC, CPM), periyot seçici (7/14/30/90 gün), günlük trend grafiği, hedef dağılımı (pasta), en çok harcama yapan kampanyalar tablosu ve bar grafik.
- **Kampanyalar:** Meta’dan kampanya listesi, arama/durum filtresi, sütun sıralama, CSV export.
- **AI Analiz:** Claude veya Gemini ile toplu kampanya analizi ve tek kampanya analizi; Türkçe yapılandırılmış çıktı (değerlendirme, öneriler, bütçe tavsiyesi).
- **Raporlama:** Kampanya/reklam seti/reklam CSV export; haftalık AI e-posta raporu (SMTP).
- **Analitik / Raporlar:** `/analytics` ve `/reports` sayfaları mevcut (analytics’te günlük trend ve özet KPI; reports temel/placeholder).

---

## 5. Ortam Değişkenleri (backend/.env)

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `META_ACCESS_TOKEN` | Evet (Meta verisi için) | Meta Graph API access token |
| `META_AD_ACCOUNT_ID` | Evet | Reklam hesabı ID (örn. `act_1333471171389618`) |
| `META_APP_ID` | Hayır | Meta uygulama ID (opsiyonel) |
| `META_APP_SECRET` | Hayır | Meta uygulama secret (opsiyonel) |
| `AI_PROVIDER` | Hayır | `claude` veya `gemini` (varsayılan: gemini key varsa gemini) |
| `ANTHROPIC_API_KEY` | Claude için | Anthropic API key |
| `GEMINI_API_KEY` | Gemini için | Google AI Studio API key |
| `SMTP_USER`, `SMTP_PASSWORD` vb. | E-posta raporu için | Gmail SMTP (uygulama şifresi) |

Meta token/hesap yoksa backend Meta çağrısı yapmaz; kampanya/özet boş döner, 503 değil 200 + boş veri.

---

## 6. Çalıştırma

- **Backend:** `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`
- **Frontend:** `cd frontend && npm install && npm run dev` (genelde http://localhost:3000 veya 3001)
- **API dokümantasyonu:** http://localhost:8000/docs

CORS: Frontend origin’i (örn. localhost:3001) backend’de izinli olmalı (`main.py`).

---

## 7. API Uç Noktaları (Özet)

| Method + Path | Açıklama |
|---------------|----------|
| `GET /api/campaigns` | Kampanya listesi (query: `days`) |
| `GET /api/campaigns/summary` | Hesap özeti (query: `days`) |
| `GET /api/campaigns/daily` | Günlük breakdown (query: `days`) |
| `GET /api/reports/export/csv` | CSV export (query: `type`, `days`) |
| `GET /api/ai/analyze` | Tüm kampanyalar AI analizi |
| `GET /api/ai/analyze/{campaign_id}` | Tek kampanya AI analizi |
| `POST /api/email/send-report` | E-posta raporu gönder |

---

## 8. Bilinmesi Gereken Teknik Detaylar

- **Meta API bazen sayısal alanları string döner** (örn. `ctr`, `roas`, `spend`). Frontend’de bu alanlar `Number(...)` ile sayıya çevrilmeli; aksi halde `.toFixed()` çağrıları `TypeError` verir. Bu dönüşüm dashboard, analytics ve campaigns sayfalarında yapıldı.
- **formatCurrency / formatNum:** API’den gelen değerler `unknown` kabul edilip `Number(v ?? 0)` ile işlenir; string gelse bile güvenli.
- **Meta yapılandırılmamışsa:** `meta_service` Meta’yı çağırmaz; kampanya/özet boş döner. Frontend’de “veri yok” veya “Meta API bağlantı hatası” mesajları gösterilir.
- **AI:** `ai_service` hem Claude hem Gemini destekler; `asyncio.to_thread` ile bloklamadan çağrılabilir.

---

## 9. Dokümantasyon (docs/)

- **SOFTWARE_FEATURES_AND_ARCHITECTURE.md** — Özellik listesi, mevcut vs hedef, mimari.
- **IMPLEMENTATION_PHASES.md** — Uygulama fazları (placeholders, CORS, hata yönetimi, Analytics/Reports, Ayarlar, çoklu hesap, AI öneri uygulama, panelden reklam oluşturma).
- **NEXT_LEVEL_FEATURES.md** — Üst seviye özellikler (tahmin, uyarılar, “Uygula”, reklam oluşturma).
- **PROMPT_FOR_CLAUDE_CODE.md** — Fazları kodlamak için prompt örneği.

---

## 10. Kısa “Yapıştır” Özeti (Tek paragraf)

Meta Ads Dashboard, Next.js 14 (frontend) ve FastAPI (backend) ile yazılmış, Meta Marketing API üzerinden reklam hesabı verilerini çeken, Türkçe arayüzlü bir raporlama ve analiz uygulamasıdır. Dashboard’da KPI’lar, günlük trend, kampanya tablosu ve grafikler; ayrıca kampanya listesi (filtre/sıralama/CSV), Claude veya Gemini ile AI analiz ve e-posta raporu vardır. Meta API bazen metrikleri string döndürdüğü için frontend’de bu değerler Number() ile sayıya çevrilir. Yapılandırma backend/.env ile yapılır; token/hesap yoksa Meta çağrılmaz ve boş veri döner. Detaylı mimari ve fazlar docs/ altındaki markdown dosyalarında anlatılır.
