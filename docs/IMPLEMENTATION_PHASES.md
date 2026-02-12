# Meta Ads Dashboard — Faz Faz Uygulama Planı

Bu belge, **SOFTWARE_FEATURES_AND_ARCHITECTURE.md** hedeflerine ulaşmak için fazlara ayrılmış, detaylı yapılacaklar listesidir. Her faz bitince çalışan ve test edilebilir bir artı değer sunar.

---

## Faz Özeti

| Faz | Ad | Odak | Tahmini süre |
|-----|-----|------|----------------|
| **Faz 1** | Eksik sayfalar & temel düzeltmeler | 404’leri kaldır, CORS, hata yönetimi, async AI | 1–2 gün |
| **Faz 2** | Analitik sayfası | Karşılaştırmalı grafikler, metrik seçici | 1–2 gün |
| **Faz 3** | Raporlar sayfası | Rapor türleri, indir / e-posta gönder | 1–2 gün |
| **Faz 4** | Ayarlar (kalıcı) | Backend ayar endpoint’i + frontend form | 1 gün |
| **Faz 5** | Çoklu hesap | Hesap seçici, API’de ad_account_id | 1–2 gün |
| **Faz 6** | Production & güvenlik | Rate limit, dokümantasyon, opsiyonel iyileştirmeler | 0.5–1 gün |
| **Faz 7** | AI tahmin + panelden uygulanabilir öneriler | Tahmin kartları, uyarılar, öneri listesi, “Uygula” aksiyonları (bütçe/duraklat) | 2–3 gün |
| **Faz 8** | Panelden reklam oluşturma ve yayınlama | Kampanya → Reklam seti → Kreatif + Reklam sihirbazı, medya yükleme, “Yayınla” | 3–4 gün |

---

## Faz 1 — Eksik Sayfalar & Temel Düzeltmeler

**Amaç:** 404’leri kaldırmak, production’a hazırlık (CORS, hata), AI’ın backend’i bloke etmemesi.

### 1.1 Yapılacaklar

#### 1.1.1 Analitik ve Raporlar için placeholder sayfalar (404 kalkması)

- **Frontend**
  - `frontend/src/app/analytics/page.tsx` oluştur.
    - Başlık: "Analitik"
    - Kısa açıklama: "Gelişmiş karşılaştırmalı grafikler burada olacak."
    - Periyot seçici (7/14/30/90 gün) ve mevcut `api.getSummary(days)` / `api.getDaily(days)` ile basit bir özet kart + basit grafik (örn. sadece günlük harcama çizgisi). Amaç: sayfa açılsın, veri gelsin; detaylı analitik Faz 2’de.
  - `frontend/src/app/reports/page.tsx` oluştur.
    - Başlık: "Raporlar"
    - Açıklama: "Hazır raporları indirin veya e-posta ile gönderin."
    - Mevcut export ve e-posta fonksiyonlarına link/buton: "CSV İndir", "E-posta ile rapor gönder" (ai-insights’taki formu buraya taşımak veya buradan oraya yönlendirmek). Amaç: 404 kalkması; tam rapor akışı Faz 3’te.

**Kabul:** Sidebar’dan "Analitik" ve "Raporlar" tıklandığında 404 yerine ilgili sayfa açılır.

---

#### 1.1.2 CORS — Ortam bazlı

- **Backend**
  - `backend/app/config.py` oluştur.
    - `os.getenv("ENVIRONMENT", "development")`
    - `CORS_ORIGINS`: `os.getenv("CORS_ORIGINS", "http://localhost:3000")` → split ile liste (virgülle ayrılmış).
  - `backend/app/main.py` güncelle.
    - `config` import et; `allow_origins=config.CORS_ORIGINS` kullan.
- **Dokümantasyon**
  - `.env.example` ve README’ye ekle: `CORS_ORIGINS=http://localhost:3000` (production’da `https://yourdomain.com`).

**Kabul:** Production’da `CORS_ORIGINS` ile birden fazla origin desteklenir; localhost tek başına da çalışır.

---

#### 1.1.3 Hata yönetimi — Production’da detay gizleme

- **Backend**
  - `config.py` içinde `IS_PRODUCTION = (os.getenv("ENVIRONMENT") == "production")` (veya benzeri).
  - Tüm router’larda `HTTPException(status_code=..., detail=...)` kullanılan yerlere:
    - `try/except` içinde gerçek hatayı `logging.exception(e)` veya `logger.error(...)` ile logla.
    - Production’da `detail="Bir hata oluştu"` (veya sabit mesaj), development’ta `detail=str(e)`.
  - İstersen merkezi exception handler: `@app.exception_handler(Exception)` ile aynı mantığı uygula.

**Kabul:** Production’da API hata cevabında sadece genel mesaj döner; detay sadece sunucu logunda görünür.

---

#### 1.1.4 AI servisi — Async (bloklamayı kaldırma)

- **Backend**
  - `backend/app/services/ai_service.py`:
    - `anthropic` sync `client.messages.create` çağrısını `asyncio.to_thread(...)` içine al VEYE Anthropic’in async client’ı varsa async kullan.
    - `analyze_campaigns`, `analyze_single_campaign`, `generate_weekly_report_text` fonksiyonları async kalacak; içerideki tek bloklayan nokta thread veya async client ile çalışsın.

**Kabul:** Aynı anda birden fazla AI isteği geldiğinde backend donmaz; diğer endpoint’ler yanıt vermeye devam eder.

---

### 1.2 Faz 1 çıktıları

- Analitik ve Raporlar sayfaları en azından placeholder + basit veri ile açılıyor.
- CORS ortam değişkeniyle yapılandırılıyor.
- Production’da hata detayı kullanıcıya gitmiyor.
- AI çağrıları async/thread ile bloklamıyor.

---

## Faz 2 — Analitik Sayfası

**Amaç:** `/analytics` sayfasında karşılaştırmalı grafikler ve metrik seçici.

### 2.1 Yapılacaklar

#### 2.1.1 Backend — Analitik endpoint’leri (gerekirse)

- Mevcut `GET /api/campaigns`, `GET /api/campaigns/daily`, `GET /api/campaigns/summary` yeterli olabilir.
- İhtiyaç olursa:
  - `backend/app/routers/analytics.py` (veya `campaigns.py` içinde):
    - Örn. `GET /api/analytics/compare?days=30&metric=spend` → kampanya bazlı metrik listesi (zaten kampanya listesinden türetilebilir).
- Karar: Frontend’de `api.getCampaigns(days)` ve `api.getDaily(days)` ile tüm veri var; ek endpoint sadece performans/kolaylık için eklenebilir.

#### 2.1.2 Frontend — Analitik sayfası içeriği

- **Sayfa:** `frontend/src/app/analytics/page.tsx`
  - Periyot: 7/14/30/90 gün.
  - Metrik seçici: Harcama, Tıklama, CTR, CPC, CPM, ROAS (tek seçim veya çoklu).
  - Grafikler:
    - Kampanyalar arası karşılaştırma: seçilen metrik için bar chart (yatay/ dikey).
    - Zaman trendi: günlük veri ile seçilen metrik(ler) için line/area chart (mevcut `getDaily`).
  - Veri: `api.getCampaigns(days)`, `api.getDaily(days)`; loading ve hata durumları.

**Kabul:** Kullanıcı periyot ve metrik seçip kampanya karşılaştırması ve günlük trendi görür.

---

### 2.2 Faz 2 çıktıları

- Analitik sayfası tam işlevsel: karşılaştırmalı grafikler + zaman trendi + metrik seçici.

---

## Faz 3 — Raporlar Sayfası

**Amaç:** `/reports` sayfasında hazır rapor türleri, indir ve e-posta ile gönder.

### 3.1 Yapılacaklar

#### 3.1.1 Backend — Rapor türleri (opsiyonel)

- Mevcut: CSV export, e-posta raporu. Yeterli olabilir.
- İstersen:
  - `GET /api/reports/weekly-summary?days=7` → özet + kampanya listesi (zaten summary + campaigns ile aynı veri).
  - Rapor “şablonü” sadece frontend’de farklı layout’lar olabilir; backend aynı endpoint’leri kullanır.

#### 3.1.2 Frontend — Raporlar sayfası

- **Sayfa:** `frontend/src/app/reports/page.tsx`
  - Rapor türü seçimi: "Haftalık özet", "Kampanya karşılaştırma", "Performans trendi" (en az biri; diğerleri sonra eklenebilir).
  - Periyot: 7/14/30 gün.
  - Aksiyonlar:
    - "CSV İndir": Mevcut `api.exportCsv(type, days)` — type’ı rapor türüne göre seç (campaigns/ads/adsets).
    - "E-posta ile gönder": Alıcı e-posta + "Gönder" → mevcut `api.sendReport(toEmail, periodDays, includeCsv)`.
  - (Opsiyonel) Rapor önizlemesi: Seçilen periyot için özet kartları (summary + kampanya sayısı).

**Kabul:** Kullanıcı rapor türü ve periyot seçip CSV indirebilir veya raporu e-posta ile gönderebilir.

---

### 3.2 Faz 3 çıktıları

- Raporlar sayfası: rapor türü + periyot + indir / e-posta gönder tamamlanmış olur.

---

## Faz 4 — Ayarlar (Kalıcı)

**Amaç:** Ayarların tek yerden yönetilmesi; production’da güvenli saklama veya .env rehberi.

### 4.1 Seçenekler

- **Seçenek A — Backend’de saklama (tercih edilebilir):**
  - Ayarlar dosya (JSON) veya veritabanında şifreli/ortam değişkeni gibi saklanır; backend başlarken bunları okur. `.env` sadece ilk kurulum veya override için kullanılabilir.
  - Risk: Secret’ların disk/DB’de güvenli tutulması gerekir.
- **Seçenek B — Sadece rehber (minimal):**
  - Backend ayar okuma/yazma endpoint’i yok; frontend’de "Ayarlar" sayfası .env örnek değerleri ve "Bu değerleri backend/.env dosyasına yazın" rehberi gösterir. "Kaydet" sadece "Rehberi gördüm" anlamında; gerçek kayıt sunucu tarafında manuel.

Bu planda **Seçenek B (rehber)** ile ilerleyip, "Kaydet" butonunun anlamını netleştiriyoruz; istenirse Faz 4’te Seçenek A için ayrı bir alt faz açılabilir.

### 4.2 Yapılacaklar (Seçenek B)

#### 4.2.1 Frontend — Ayarlar sayfası netleştirme

- Mevcut `settings/page.tsx`:
  - Form alanlarını "örnek / rehber" olarak işaretle (placeholder ve label’larda).
  - "Kaydet" butonu: "Bu form değerleri sunucuya gönderilmez. Yapılandırmayı backend/.env dosyasında yapın." uyarısı + isteğe bağlı "Kopyala" (örnek .env satırlarını panoya).
- (Opsiyonel) Backend’de `GET /api/settings/env-example` → .env örnek içeriği döner; frontend bunu gösterir (secret’lar boş placeholder).

**Kabul:** Kullanıcı ayarlar sayfasından ne yapması gerektiğini anlar; gerçek konfigürasyon .env ile yapılır.

#### 4.2.2 (Seçenek A yapılacaksa) Backend ayar endpoint’i

- `backend/app/routers/settings.py`:
  - `GET /api/settings`: Mevcut ayarların listesi (hassas alanlar maskele: örn. token son 4 karakter). Sadece okuma; kaynak .env veya güvenli dosya.
  - `POST /api/settings`: Body’de key-value; backend bunu güvenli bir yere yazar ve uygulama bir sonraki istekte kullanır (uygulama restart gerekebilir veya runtime’da yükleme).
- Güvenlik: Bu endpoint’ler sadece güvenli ortamda (örn. admin auth) açılmalı; production’da dikkatli kullanılmalı.

---

### 4.3 Faz 4 çıktıları

- Ayarlar sayfası ya rehber odaklı (Seçenek B) ya da backend ile kalıcı (Seçenek A) tamamlanmış olur.

---

## Faz 5 — Çoklu Hesap

**Amaç:** Birden fazla Meta reklam hesabı seçilebilmesi; tüm veri istekleri seçilen hesaba gider.

### 5.1 Yapılacaklar

#### 5.1.1 Backend — ad_account_id parametresi

- **config / env:** Varsayılan `META_AD_ACCOUNT_ID` kalır; ek olarak istek bazlı hesap kullanılacak.
- **meta_service.py:**
  - `MetaAdsService` sınıfında `account_id` parametresi: constructor’da varsayılan `META_AD_ACCOUNT_ID`, ama her metod çağrısında override edilebilir (örn. `get_campaigns(account_id=None)` → `account_id or self.account_id`).
  - Tüm Meta API çağrılarında kullanılan hesap ID’si bu değer olsun.
- **Routers:**
  - Kampanya, özet, günlük, rapor, AI, e-posta endpoint’lerine `ad_account_id: Optional[str] = Query(None)` ekle.
  - `ad_account_id` yoksa env’deki varsayılan kullanılır; varsa `meta_service` bu ID ile çağrılır.

#### 5.1.2 Hesap listesi (kaynak nereden?)

- **Basit yaklaşım:** Hesap listesi .env’de virgülle ayrılmış: `META_AD_ACCOUNT_IDS=act_111,act_222` ve isteğe bağlı `META_AD_ACCOUNT_NAMES=Hesap1,Hesap2`. Backend `GET /api/accounts` (veya `/api/campaigns/accounts`) ile bu listeyi döner (id + isim). Token’ın tüm bu hesaplara erişimi olmalı.
- **Alternatif:** Meta API’den "ad accounts" listesi çekilebilir (izin ve endpoint’e bağlı).

#### 5.1.3 Frontend — Hesap seçici

- **Context veya state:** Seçilen `ad_account_id` (örn. React Context veya global state). Varsayılan: ilk hesap veya backend’in döndüğü varsayılan.
- **Component:** `AccountSwitcher` — dropdown; liste `GET /api/accounts` (veya campaigns’ten türetilmiş) ile doldurulur.
- **Layout / Sidebar:** Hesap seçici sidebar’da veya header’da gösterilir.
- **api.ts:** Tüm ilgili fonksiyonlara `ad_account_id?: string` parametresi ekle; isteklerde query string olarak gönder: `?ad_account_id=act_xxx`.
- **Tüm sayfalar:** Dashboard, Kampanyalar, Analitik, Raporlar, AI Insights sayfaları hesap seçiciden gelen değeri kullanır (context’ten okuyup api çağrılarına verir).

**Kabul:** Kullanıcı dropdown’dan hesap seçer; tüm sayfalardaki veri seçilen hesaba ait olur.

---

### 5.2 Faz 5 çıktıları

- Çoklu hesap desteklenir; hesap seçici tüm veri akışına yansır.

---

## Faz 6 — Production & Güvenlik

**Amaç:** Canlı ortam için CORS, hata, rate limit ve dokümantasyon.

### 6.1 Yapılacaklar

#### 6.1.1 Rate limit (opsiyonel ama önerilen)

- Backend’de endpoint bazlı basit rate limit (örn. dakikada 60 istek / IP veya / API key). Kütüphane: `slowapi` veya manuel sayaç + cache.
- Özellikle `/api/ai/*` ve Meta’yı çağıran endpoint’lerde sınır konulabilir.

#### 6.1.2 Dokümantasyon

- README’de:
  - Production’da `ENVIRONMENT=production`, `CORS_ORIGINS=https://yourdomain.com` kullanımı.
  - Meta token: uzun süreli / System User token linki.
  - Opsiyonel: Çoklu hesap için `META_AD_ACCOUNT_IDS` ve `META_AD_ACCOUNT_NAMES` örnekleri.
- SOFTWARE_FEATURES_AND_ARCHITECTURE.md ve IMPLEMENTATION_PHASES.md proje kökünde veya `docs/` altında referans olarak kalsın.

#### 6.1.3 Küçük iyileştirmeler

- Health check: `GET /health` → 200 + `{"status":"ok"}` (opsiyonel).
- Docker: production için multi-stage build veya frontend’de `npm run build` + `npm run start` (şu an dev modunda çalışıyor olabilir); docker-compose’ta production profili eklenebilir.

**Kabul:** Production checklist (CORS, env, token, rate limit) dokümante edilmiş ve uygulanmış olur.

---

## Faz 7 — AI Tahmin + Panelden Uygulanabilir Öneriler

**Amaç:** AI tahminlerinin ve iyileştirme önerilerinin panelde gösterilmesi; kullanıcının “Uygula” ile bütçe güncelleme, kampanya duraklatma/başlatma gibi aksiyonları panelden yapabilmesi. Detay: **[NEXT_LEVEL_FEATURES.md](./NEXT_LEVEL_FEATURES.md)**.

### 7.1 Yapılacaklar

#### 7.1.1 Backend — Tahmin ve anomali

- **Tahmin endpoint’leri:** Örn. `GET /api/ai/forecast?days=30` → hesap/kampanya bazlı harcama tahmini (mevcut veri + basit trend veya AI).
- **Bütçe senaryosu:** `POST /api/ai/budget-scenario` (campaign_id veya adset_id, yeni bütçe veya yüzde) → tahmini gösterim/tıklama/dönüşüm metni.
- **Anomali / uyarılar:** Günlük veya periyodik job ile harcama/CTR/ROAS sapması hesapla; `GET /api/alerts` veya `GET /api/ai/anomalies` ile listele.

#### 7.1.2 Backend — Öneriyi uygulama (Meta API yazma)

- **Kampanya/ad set durumu:** `PATCH /api/campaigns/{id}/status` (body: `status=PAUSED|ACTIVE`); backend Meta API ile ilgili kampanya/ad set güncellemesi yapar.
- **Bütçe güncelleme:** `PATCH /api/adsets/{id}/budget` (body: `daily_budget` veya `lifetime_budget`); Meta API ad set güncelleme.
- **Öneri kaydı (opsiyonel):** Öneri “uygulandı” olarak işaretlensin diye basit tablo veya alan; `POST /api/ai/recommendations/{id}/apply` ile aksiyon tetiklenir ve kayıt güncellenir.

#### 7.1.3 Frontend — Tahmin ve uyarılar

- **Dashboard’da tahmin kartı:** “Tahmini ay sonu harcama” veya “Son 7 gün tahmini”; periyot seçici.
- **Uyarılar / Anomaliler sayfası veya bileşen:** Liste (kampanya, metrik, sapma, öneri); “Kampanyaya git”, “Duraklat”, “Bütçe düşür” butonları → ilgili API çağrıları.

#### 7.1.4 Frontend — AI önerileri listesi ve “Uygula”

- **Sayfa:** “AI Önerileri” veya mevcut AI Insights sayfasında “Öneriler” sekmesi. Kampanya/reklam seti bazlı öneri listesi (AI’dan gelen metin + öneri türü: bütçe_artır, duraklat, başlat, yeni_kreatif).
- **Aksiyonlar:** Her satırda “Uygula” (bütçe için form açılır, duraklat/başlat için onay); “Reddet” / “Daha sonra”. Uygulandığında backend’deki PATCH endpoint’leri çağrılır.

**Kabul:** Kullanıcı tahmin ve uyarıları panelde görür; AI önerisini “Uygula” ile bütçe güncelleme veya kampanya duraklatma/başlatma yapabilir.

---

## Faz 8 — Panelden Reklam Oluşturma ve Yayınlama

**Amaç:** Panelde kampanya → reklam seti → kreatif + reklam oluşturma sihirbazı; medya yükleme, hedef kitle, bütçe; “Yayınla” ile reklamın Meta’da canlıya alınması. Detay: **[NEXT_LEVEL_FEATURES.md](./NEXT_LEVEL_FEATURES.md)**.

### 8.1 Yapılacaklar

#### 8.1.1 Backend — Meta API yazma (create)

- **Kampanya oluştur:** `POST /api/campaigns` (name, objective, status) → Meta `POST /{ad_account_id}/campaigns`.
- **Reklam seti oluştur:** `POST /api/adsets` (campaign_id, name, daily_budget veya lifetime_budget, targeting, start_time, end_time, billing_event, optimization_goal) → Meta `POST /{ad_account_id}/adsets`.
- **Medya yükleme:** `POST /api/creatives/upload-image` ve `POST /api/creatives/upload-video` → dosyayı al, Meta’ya image/video upload API ile yükle; hash veya video_id döndür.
- **Kreatif oluştur:** `POST /api/creatives` (object_story_spec: image/video, metin, headline, link, CTA) → Meta `POST /{ad_account_id}/adcreatives`.
- **Reklam oluştur:** `POST /api/ads` (adset_id, creative_id, name, status=PAUSED|ACTIVE) → Meta `POST /{ad_account_id}/ads`.
- **Yayınlama:** Kampanya / ad set / ad için status güncelleme (mevcut create’te ACTIVE verilebilir veya ayrı `PATCH .../status`).

#### 8.1.2 Backend — Hedef kitle ve seçenekler

- **Meta targeting spec:** Ülke, yaş, cinsiyet, ilgi alanları (interests), yerleşimler (placements) için Meta API’den okunabilir veya sabit liste; `GET /api/targeting-options` (opsiyonel) ile frontend’e sunulur.
- **Objective listesi:** Meta’daki campaign objective değerleri (LINK_CLICKS, CONVERSIONS, OUTCOME_TRAFFIC, vb.) dokümantasyondan veya API’den; frontend dropdown için.

#### 8.1.3 Frontend — Reklam oluşturma sihirbazı

- **Adım 1 — Kampanya:** Yeni kampanya (ad, objective, başlangıç status) veya mevcut kampanya seçimi.
- **Adım 2 — Reklam seti:** Ad set adı, bütçe (günlük/toplam), tarih aralığı, hedef kitle (ülke, yaş, cinsiyet, ilgi alanları, yerleşimler), teklif stratejisi.
- **Adım 3 — Kreatif + Reklam:** Görsel/video yükleme (upload → backend → Meta), birincil metin, başlık, CTA, hedef URL. Reklam adı. “Taslak olarak kaydet” (PAUSED) veya “Yayınla” (ACTIVE).
- **Adım 4 — Önizleme (opsiyonel):** Meta preview API varsa kullanılır; yoksa basit “Özet” ekranı.
- **Navigasyon:** Sidebar’da “Reklam Oluştur” veya kampanya listesinde “Yeni reklam seti” / “Bu kampanyada reklam oluştur” ile sihirbaza giriş.

**Kabul:** Kullanıcı panelden kampanya → reklam seti → reklam (kreatif) oluşturup “Yayınla” ile reklamı Meta’da canlıya alabilir.

---

## Faz Bağımlılıkları

```
Faz 1 ──────────────────────────────────────────────────────────────►
  │
  ├─► Faz 2 (Analitik) — Faz 1’deki placeholder sayfa genişletilir
  │
  ├─► Faz 3 (Raporlar) — Faz 1’deki placeholder sayfa genişletilir
  │
  ├─► Faz 4 (Ayarlar) — Bağımsız
  │
  ├─► Faz 5 (Çoklu hesap) — Backend meta_service + tüm router’lar; frontend api + context
  │
  ├─► Faz 6 — Faz 1–5 tamamlandıktan sonra uygulanabilir
  │
  ├─► Faz 7 (AI tahmin + uygulanabilir öneriler) — Faz 1–5 tamamlandıktan sonra; Meta API yazma izinleri gerekir
  │
  └─► Faz 8 (Panelden reklam oluşturma/yayınlama) — Faz 7 ile paralel veya sonra; Meta campaigns/adsets/ads/create API
```

---

## Kontrol Listesi (Her faz sonrası)

- [ ] İlgili sayfalar/endpoint’ler yerel ortamda test edildi.
- [ ] Hata senaryoları (API down, geçersiz token) denendi.
- [ ] README veya docs güncellendi (yeni env, yeni sayfa).
- [ ] (Faz 5 sonrası) Hesap değiştirince tüm sayfalar doğru veriyi gösteriyor.
- [ ] (Faz 7 sonrası) AI önerisi “Uygula” ile bütçe/duraklat/başlat Meta’da güncelleniyor.
- [ ] (Faz 8 sonrası) Sihirbazdan oluşturulan reklam Meta’da görünüyor ve yayında.

Bu doküman, **IMPLEMENTATION_PHASES.md** olarak saklanabilir ve her faz bitiminde ilgili maddeler işaretlenerek ilerlenebilir. Üst seviye özellikler için ** [NEXT_LEVEL_FEATURES.md](./NEXT_LEVEL_FEATURES.md) ** ve puan/rakip için ** [RATING_AND_COMPETITORS.md](./RATING_AND_COMPETITORS.md) ** referans alınabilir.
