# Meta Ads Dashboard — Üst Seviye Özellikler (Yalnızca Meta)

Bu belge, **sadece Meta (Facebook & Instagram) Ads** için üst seviye geliştirmeleri tanımlar: AI tahmin/iyileştirme önerilerinin **panelden yönetilmesi** ve **panelden reklam oluşturup yayınlama** hedeflenir.

---

## 1. Genel Hedef

- **Kanal:** Sadece Meta — çok kanallı (Google, LinkedIn, TikTok) hedeflenmez.
- **AI:** Tahmin ve iyileştirme önerileri panelde gösterilir; kullanıcı öneriyi **onaylayıp uygulayabilir** (bütçe değiştir, kampanya duraklat, vb.).
- **Reklam yönetimi:** Kampanya, reklam seti ve reklam **panelden oluşturulur** ve **yayınlanır** (Meta API ile canlıya alınır).

---

## 2. AI Tahmin Sistemleri (Panelden Görüntüleme ve Yönetim)

**Şu an:** AI sadece metin analizi ve öneri veriyor; aksiyon manuel.  
**Üst seviye:** Tahminler ve öneriler panelde gösterilir; istenen aksiyonlar panelden tek tıkla uygulanabilir.

### 2.1 Tahmin (Forecasting)

| Özellik | Açıklama | Panelde nasıl yönetilir |
|--------|----------|---------------------------|
| **Harcama tahmini** | “Bu hızla gidersen son 7/30 günde toplam harcama tahmini X TL” | Dashboard’da “Tahmini ay sonu harcama” kartı; periyot seçici (7/30 gün). |
| **Bütçe senaryosu** | “Bu kampanyada günlük bütçeyi %20 artırırsan tahmini gösterim/tıklama/dönüşüm” | Kampanya detayında “Bütçe simüle et” alanı; yüzde veya TL girişi → tahmin gösterilir; istenirse “Bu bütçeyi uygula” ile gerçek bütçe güncellenir. |
| **ROAS / performans tahmini** | Geçmiş trende göre “önceki 14 günün ortalamasına göre tahmini ROAS” | Kampanya/reklam seti satırında “Tahmini ROAS” sütunu; AI raporunda da yer alır. |

**Teknik not:** Tahminler mevcut insights verisi + basit istatistik (ortalama, trend) veya AI ile üretilebilir; panelde “Uygula” dediğinizde ilgili Meta API çağrısı (örn. bütçe güncelleme) yapılır.

### 2.2 Anomali Tespiti

| Özellik | Açıklama | Panelde nasıl yönetilir |
|--------|----------|---------------------------|
| **Harcama ani artış/azalış** | “Dün harcama ortalamanın 2 katı” / “Son 3 gün harcama çok düşük” | “Uyarılar” veya “Anomaliler” sayfası/listesi; kampanya adı, metrik, sapma; “Kampanyaya git” / “Duraklat” aksiyonu. |
| **CTR / ROAS düşüşü** | “Bu kampanyada CTR son 7 günde belirgin düştü” | Aynı uyarı listesinde; “AI öneriyi gör” → öneri panelde; “Kampanyayı duraklat” veya “Bütçeyi düşür” butonu. |
| **Frequency yüksek** | “Reklam yorgunluğu riski (frequency > 3)” | Kampanya listesinde işaret; AI öneri: “Yeni kreatif ekle” veya “Hedef kitleyi genişlet”; panelden “Yeni reklam oluştur” linki. |

**Panel akışı:** Uyarılar sayfası → Uyarı kartı (metrik, kampanya, öneri) → Aksiyon butonları (Duraklat, Bütçe düşür, Kampanyaya git, Reklam oluştur).

### 2.3 İyileştirme Önerileri (Panelden Uygulanabilir)

AI’ın verdiği öneriler sadece metin değil; panelde **öneri kartı** ve **uygula** aksiyonu olacak.

| Öneri türü | Örnek AI çıktısı | Panelde aksiyon |
|------------|-------------------|-----------------|
| **Bütçe artır/düşür** | “Bu kampanya iyi performans veriyor; günlük bütçeyi %15 artır” | “Öneriyi uygula” → Bütçe güncelleme formu (yeni günlük bütçe) → Meta API ile ad set bütçesi güncellenir. |
| **Kampanya duraklat** | “ROAS 3 gündür 1’in altında; duraklatmayı öneriyorum” | “Duraklat” butonu → Meta API: kampanya veya ad set status = PAUSED. |
| **Kampanya başlat** | “Duraklatılmış bu kampanya geçmişte iyiydi; tekrar açmayı deneyin” | “Başlat” butonu → status = ACTIVE. |
| **Teklif stratejisi** | “CPC yüksek; lowest cost yerine cost cap deneyin” | “Öneriyi uygula” → Ad set düzenleme ekranında teklif stratejisi alanı → API ile güncelleme. |
| **Yeni kreatif** | “Bu reklam setinde yorgunluk var; yeni görsel/video ekleyin” | “Yeni reklam oluştur” → Reklam oluşturma sihirbazına yönlendir (aşağıda); aynı ad set’e yeni ad eklenir. |

**Öneri listesi sayfası:** “AI Önerileri” sayfasında kampanya/reklam seti bazlı öneriler listelenir; her satırda “Uygula”, “Reddet”, “Daha sonra” gibi aksiyonlar. Uygulandığında ilgili Meta API çağrısı yapılır ve öneri “uygulandı” olarak işaretlenir.

---

## 3. Panelden Reklam Oluşturma ve Yayınlama

**Hedef:** Kullanıcı panelde kampanya → reklam seti → reklam (kreatif) oluşturur ve **yayınlar**; reklam Meta’da canlıya alınır.

### 3.1 Meta API Hiyerarşisi (Özet)

Meta Marketing API’de sıra şöyledir:

1. **Kampanya (Campaign)** — hedef/amaç (örn. trafik, dönüşüm, satış).
2. **Reklam seti (Ad Set)** — bütçe, tarih aralığı, hedef kitle (targeting).
3. **Reklam kreatifi (Ad Creative)** — görsel/video, başlık, metin, CTA.
4. **Reklam (Ad)** — bir kreatifi bir reklam setine bağlar; status ACTIVE olunca yayında.

Panel akışı bu sırayı takip eder: Önce kampanya (veya mevcut kampanya seçimi), sonra reklam seti, sonra kreatif + reklam, en son “Yayınla” ile status = ACTIVE.

### 3.2 Panel Akışı (Adım adım)

#### Adım 1 — Kampanya

- **Yeni kampanya oluştur** veya **Mevcut kampanya kullan**.
- Yeni ise:
  - **Ad:** Kampanya adı.
  - **Hedef (objective):** Liste (LINK_CLICKS, CONVERSIONS, OUTCOME_TRAFFIC, OUTCOME_SALES, vb. — Meta API’deki değerler).
  - **Durum:** Başlangıçta PAUSED önerilir; kullanıcı “Yayınla” dediğinde ACTIVE yapılabilir.
- Backend: `POST /act_{ad_account_id}/campaigns` (name, objective, status).

#### Adım 2 — Reklam seti

- **Kampanya:** Yukarıda seçilen veya oluşturulan kampanya.
- **Ad set adı.**
- **Bütçe:** Günlük (daily_budget) veya toplam (lifetime_budget); para birimi (örn. TRY, Meta’da cents).
- **Tarih:** Başlangıç ve bitiş (opsiyonel).
- **Hedef kitle (targeting):**
  - Ülke, şehir, yaş, cinsiyet.
  - İlgi alanları (interests), davranışlar (behaviors) — Meta API targeting spec.
  - Yerleşimler (placements): Facebook feed, Instagram feed, Stories, vb.
- **Teklif stratejisi:** Örn. lowest_cost, cost_cap (varsa bid_amount).
- Backend: `POST /act_{ad_account_id}/adsets` (campaign_id, name, daily_budget veya lifetime_budget, targeting, billing_event, optimization_goal, vb.).

#### Adım 3 — Kreatif ve reklam

- **Görsel veya video:**
  - **Yükle:** Panelden dosya yükleme → Backend geçici veya kalıcı depoya alır → Meta’ya **Ad Image** veya **Ad Video** olarak yüklenir (Marketing API: image upload / video upload); hash veya creative ID alınır.
- **Metin:**
  - Birincil metin (primary text), başlık (headline), açıklama (description) — Meta creative alanlarına göre.
- **CTA:** Call-to-action butonu (LEARN_MORE, SHOP_NOW, SIGN_UP, vb.).
- **Link:** Hedef URL (örn. web sitesi, landing page).
- **Kullanım yerleri:** Hangi yerleşimlerde görünsün (feed, story; otomatik veya manuel).
- Backend:
  - Önce **Ad Creative** oluşturulur: `POST /act_{ad_account_id}/adcreatives` (object_story_spec ile image/video + metin + link + CTA).
  - Sonra **Ad** oluşturulur: `POST /act_{ad_account_id}/ads` (name, adset_id, creative = { creative_id }, status = PAUSED veya ACTIVE).

#### Adım 4 — Yayınlama

- Kullanıcı panelde “Reklamı yayınla” / “Canlıya al” seçer.
- Backend: İlgili kampanya / ad set / reklam için `POST` ile status güncelleme (örn. `status = ACTIVE`). Meta dokümantasyonunda campaign, ad set ve ad için status alanı güncellenir.
- Sonuç: Reklam Meta’da canlıya alınmış olur; panelde “Yayında” etiketi ve (isterseniz) “Duraklat” butonu gösterilir.

### 3.3 Panelde Gerekli Sayfalar / Bileşenler

| Bileşen | Açıklama |
|--------|----------|
| **Reklam oluştur (Create Ad)** | Sihirbaz veya adım adım form: Kampanya → Reklam seti → Kreatif + Reklam. |
| **Kampanya listesi (mevcut)** | “Yeni reklam seti ekle” / “Bu kampanyada reklam oluştur” aksiyonu ile reklam oluşturma akışına giriş. |
| **Reklam seti listesi** | Kampanya detayında reklam setleri; “Yeni reklam” butonu → kreatif + reklam adımı. |
| **Medya yükleme** | Görsel/video upload → backend’de dosya saklama + Meta’ya upload API çağrısı. |
| **Hedef kitle seçici** | Ülke, yaş, cinsiyet, ilgi alanları (Meta targeting spec) — dropdown’lar veya arama. |
| **Önizleme (opsiyonel)** | Oluşturulan kreatifin Facebook/Instagram önizlemesi (Meta’nın preview API’si varsa kullanılabilir). |

### 3.4 Backend API Özeti (Meta)

- `POST /{ad_account_id}/campaigns` — Kampanya oluştur (name, objective, status).
- `POST /{ad_account_id}/adsets` — Reklam seti oluştur (campaign_id, name, budget, targeting, vb.).
- Görsel: Image upload (Multipart veya URL) → Ad Creative’te image_hash kullanımı.
- Video: Video upload (async) → video_id ile Ad Creative.
- `POST /{ad_account_id}/adcreatives` — Kreatif oluştur (object_story_spec: link, image/video, metin, CTA).
- `POST /{ad_account_id}/ads` — Reklam oluştur (adset_id, creative, name, status).
- `POST /{campaign_id}` veya `POST /{adset_id}` veya `POST /{ad_id}` — status güncelleme (ACTIVE/PAUSED).

**İzinler:** Meta uygulamasında `ads_management`, `ads_read`, `business_management` gibi izinler; reklam oluşturma için token’ın yazma yetkisi olmalı.

---

## 4. Diğer Üst Seviye Özellikler (Meta Odaklı)

Aşağıdakiler **sadece Meta** ile sınırlı kalır; çok kanal eklenmez.

### 4.1 Otomasyon ve Kurallar (Meta kampanya/reklam üzerinde)

- Uyarı kuralları: Harcama, CTR, ROAS eşiği → e-posta/bildirim.
- Otomatik duraklatma: Kural tetiklenince Meta API ile kampanya/ad set status = PAUSED.
- Bütçe tavanı: Limite yaklaşınca uyarı veya otomatik bütçe düşürme (API ile ad set güncelleme).
- Zamanlanmış raporlar: Haftalık/aylık e-posta (cron).

### 4.2 Veri ve Rapor (Meta verisi)

- Geçmiş veriyi kendi veritabanında saklama (günlük/haftalık snapshot); yıllık trend.
- PDF rapor, özelleştirilebilir şablon (Meta metrikleri).
- Webhook/API: “Rapor hazır”, “Uyarı tetiklendi” event’leri.

### 4.3 Takım ve Güvenlik

- Çok kullanıcı, roller (Admin / Editör / Görüntüleyici).
- Hesap bazlı yetki (hangi kullanıcı hangi Meta hesaplarını görsün).
- Audit log: Kim hangi kampanyayı oluşturdu/duraklattı, reklamı yayınladı.
- 2FA, SSO (opsiyonel).

---

## 5. Özet: Next Level’da Neler Var?

| Alan | İçerik |
|------|--------|
| **Kanal** | Yalnızca Meta (Facebook & Instagram); başka kanal yok. |
| **AI tahmin** | Harcama tahmini, bütçe senaryosu, ROAS tahmini; hepsi panelde gösterilir. |
| **AI iyileştirme önerileri** | Öneriler panelde listelenir; “Uygula” ile bütçe güncelleme, duraklatma, başlatma, yeni reklam oluşturma gibi aksiyonlar panelden yapılır. |
| **Panelden reklam** | Kampanya → Reklam seti → Kreatif + Reklam oluşturma sihirbazı; medya yükleme, hedef kitle, bütçe; “Yayınla” ile status = ACTIVE ve reklam Meta’da canlıya alınır. |
| **Otomasyon** | Kurallar ve uyarılar (sadece Meta varlıkları üzerinde); zamanlanmış raporlar. |
| **Veri** | Meta geçmiş verisi; PDF/şablon; webhook. |
| **Takım / güvenlik** | Roller, yetki, audit log, 2FA/SSO. |

Bu belge, geliştirme roadmap’i için referans alınabilir; teknik detay (endpoint, alan adları) implementasyon sırasında Meta Marketing API dokümantasyonu ile teyit edilmelidir.
