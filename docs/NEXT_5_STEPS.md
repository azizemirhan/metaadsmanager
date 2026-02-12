# Sıradaki 5 Adım

Faz 1 (CORS + production hata gizleme) tamamlandı. Aşağıdaki 5 adım öncelik sırasıyla uygulanabilir.

---

## Adım 1 — Analitik sayfasını geliştir (Faz 2)

**Hedef:** `/analytics` sayfasında metrik seçici ve kampanya karşılaştırma grafiği.

- **Frontend:** Periyot (7/14/30/90 gün) zaten var; **metrik seçici** ekle: Harcama, Tıklama, CTR, CPC, CPM, ROAS (tek veya çoklu).
- **Kampanya karşılaştırma:** Seçilen metrik için kampanyalar arası **bar chart** (yatay/dikey); veri `api.getCampaigns(days)` ile.
- **Zaman trendi:** Mevcut günlük harcama grafiğine seçilen metrik(ler) için çizgi/alan eklenebilir (`getDaily` verisi).
- **Kabul:** Kullanıcı periyot ve metrik seçip kampanya karşılaştırması + trend grafiğini görür.

**Dosyalar:** `frontend/src/app/analytics/page.tsx` (mevcut sayfa genişletilir).

---

## Adım 2 — Raporlar sayfasını tamamla (Faz 3)

**Hedef:** Rapor türleri, net indir/e-posta akışı.

- **Rapor türleri:** “Haftalık özet”, “Kampanya karşılaştırma”, “Performans trendi” gibi hazır rapor tipleri (UI’da seçim).
- **Periyot ve format:** Mevcut periyot seçici; format: CSV (mevcut), isteğe bağlı ileride PDF.
- **Aksiyonlar:** “Raporu indir” (CSV/HTML), “E-posta ile gönder” (mevcut form ile bağlantı).
- **Kabul:** Kullanıcı rapor türü + periyot seçip indirir veya e-posta ile gönderir.

**Dosyalar:** `frontend/src/app/reports/page.tsx`; backend’de gerekirse `reports` router’a ek endpoint (örn. özet rapor HTML).

---

## Adım 3 — Ayarları kalıcı yap (Faz 4)

**Hedef:** Ayarlar sayfasındaki değerler backend’de saklansın (veya .env proxy).

- **Backend:** Ayarlar için endpoint’ler: `GET /api/settings` (mevcut yapılandırma — hassas alanlar maskele veya sadece “yapılandırıldı mı” bilgisi), `PUT` veya `POST /api/settings` (güncelleme). Değerler dosyada (örn. `settings.json`) veya env’e yazılacak şekilde tutulabilir; production’da şifreleme düşünülebilir.
- **Frontend:** `settings/page.tsx` formunu bu endpoint’lere bağla; kaydet butonu ile PUT/POST, sayfa açılışında GET ile doldur.
- **Güvenlik:** En azından production’da endpoint’i basit bir API key veya auth ile korumak mantıklı.
- **Kabul:** Kullanıcı ayarları kaydettiğinde bir sonraki açılışta aynı değerler görünür (veya “kaydedildi” geri bildirimi alır).

**Dosyalar:** `backend/app/routers/settings.py` (yeni), `backend/app/main.py` (router ekleme), `frontend/src/app/settings/page.tsx`, `frontend/src/app/lib/api.ts` (settings get/update).

---

## Adım 4 — Çoklu reklam hesabı (Faz 5)

**Hedef:** Birden fazla Meta reklam hesabı seçip veriyi hesaba göre görüntüleme.

- **Backend:** Kampanya/özet/günlük endpoint’lerine **opsiyonel** `ad_account_id` query parametresi ekle (örn. `?ad_account_id=act_123`). Verilmezse mevcut `META_AD_ACCOUNT_ID` kullanılsın. Meta token’ın ilgili hesaplara erişimi olmalı.
- **Hesap listesi:** `GET /api/accounts` veya mevcut bir endpoint ile kullanıcının erişebildiği reklam hesaplarını döndür (Meta API: `me/adaccounts` veya Business Manager API).
- **Frontend:** Dashboard ve kampanya/analitik sayfalarında **hesap seçici** (dropdown); seçilen hesap API çağrılarına `ad_account_id` olarak gider.
- **Kabul:** Kullanıcı listeden hesap seçer; tüm veri o hesaba göre güncellenir.

**Dosyalar:** `backend/app/services/meta_service.py` (hesap listesi, account_id parametresi), `backend/app/routers/campaigns.py` (query param), `frontend/src/app/lib/api.ts`, ilgili sayfalar (state + dropdown).

---

## Adım 5 — Production ve güvenlik (Faz 6)

**Hedef:** Canlı ortam için rate limit, dokümantasyon, küçük iyileştirmeler.

- **Rate limit:** Backend’e istek sınırı (örn. dakikada 60 istek / IP veya API key). FastAPI için `slowapi` veya middleware ile yapılabilir.
- **Dokümantasyon:** README’de production checklist: `ENVIRONMENT=production`, `CORS_ORIGINS`, token (System User), HTTPS, env’in güvenli tutulması.
- **Opsiyonel:** Health check endpoint (`/health`), basit bir “API versiyonu” veya durum bilgisi.
- **Kabul:** Production’da aşırı istek sınırlanır; deploy eden kişi dokümandan adımları takip edebilir.

**Dosyalar:** `backend/app/main.py` (middleware veya rate limit), `backend/requirements.txt` (gerekirse slowapi), `README.md` veya `docs/DEPLOYMENT.md`.

---

## Özet tablo

| # | Adım | Kısa açıklama | Faz |
|---|------|----------------|-----|
| 1 | Analitik gelişmiş | Metrik seçici + kampanya karşılaştırma grafiği | Faz 2 |
| 2 | Raporlar tam | Rapor türleri, indir/e-posta akışı | Faz 3 |
| 3 | Ayarlar kalıcı | Backend ayar endpoint’i + frontend form | Faz 4 |
| 4 | Çoklu hesap | Hesap seçici, API’de ad_account_id | Faz 5 |
| 5 | Production & güvenlik | Rate limit, dokümantasyon | Faz 6 |

Bu 5 adım bittikten sonra sırada: WhatsApp entegrasyonu (docs/WHATSAPP_INTEGRATION.md), AI tahmin + “Uygula” (Faz 7), panelden reklam oluşturma (Faz 8) var.
