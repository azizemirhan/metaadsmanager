# Meta Ads Dashboard — Proje Durum Analizi

Bu belge projenin **şu anki** durumunu özetler: ne tamamlandı, ne eksik, sıradaki adımlar neler.

---

## 1. Genel Özet

| Alan | Durum | Not |
|------|--------|-----|
| **Çekirdek işlev** | ✅ Çalışır | Dashboard, kampanyalar, özet, günlük veri, AI analiz, CSV, e-posta raporu |
| **Sayfalar** | ✅ 404 yok | Ana sayfa, Kampanyalar, Analitik, Raporlar, AI İçgörüleri, Ayarlar |
| **Meta API** | ✅ Yapılandırıldı | Token/hesap kontrolü, hata yönetimi, boş veri durumu |
| **Frontend hatalar** | ✅ Giderildi | Metrikler `Number()` ile; toFixed TypeError yok |
| **AI** | ✅ Claude + Gemini | Async (asyncio.to_thread), provider seçimi |
| **CORS** | ⚠️ Sabit liste | Ortam değişkeniyle (Faz 1) henüz yok |
| **Ayarlar** | ⚠️ Sadece UI | Kalıcı backend kaydı yok |
| **Çoklu hesap** | ❌ Yok | Tek META_AD_ACCOUNT_ID |
| **WhatsApp** | 📄 Planlandı | docs/WHATSAPP_INTEGRATION.md; kod yok |

---

## 2. Tamamlananlar (Mevcut Durum)

### 2.1 Backend

- **main.py:** FastAPI, CORS (localhost:3000, 3001, 127.0.0.1), 4 router (campaigns, reports, ai_analysis, email_reports).
- **meta_service.py:**
  - `_is_meta_configured()`: Placeholder token/hesap kontrolü; yapılandırılmamışsa Meta çağrılmıyor, boş liste/özet dönüyor.
  - `MetaAPIError`; hatalar loglanıyor.
  - Kampanya, özet, günlük breakdown, ad sets, ads endpoint’leri.
- **campaigns router:** MetaAPIError → 503 + Türkçe mesaj; `GET /api/campaigns` ve `GET /api/campaigns/` ikisi de tanımlı (307 önlenmiş).
- **ai_service.py:** Claude ve Gemini; `AI_PROVIDER` / `GEMINI_API_KEY` ile seçim; tüm AI çağrıları `asyncio.to_thread` ile async.
- **reports:** CSV export (campaigns, adsets, ads).
- **email_reports:** Haftalık AI raporu e-posta gönderimi (SMTP).

### 2.2 Frontend

- **Dashboard (page.tsx):** KPI kartları, günlük trend (AreaChart), hedef dağılımı (PieChart), kampanya tablosu, en çok harcama yapan 5 kampanya (BarChart). API hatası ve “veri yok” durumları için uyarı kutuları. Tüm metrikler `Number(...)` ile güvenli.
- **Kampanyalar:** Liste, arama, durum filtresi, sütun sıralama, CSV export. Metrikler sayıya çevrilerek gösteriliyor.
- **Analitik (/analytics):** Periyot seçici, özet kartlar (harcama, gösterim, tıklama, CTR), günlük harcama trendi (AreaChart). Veri yoksa bilgilendirme mesajı.
- **Raporlar (/reports):** Periyot seçici, CSV indir (campaigns/ads/adsets), e-posta ile rapor gönder formu.
- **AI İçgörüleri:** Toplu ve tek kampanya analizi, haftalık rapor.
- **Ayarlar:** UI var; değerler backend’e kalıcı kaydedilmiyor.
- **api.ts:** getCampaigns, getSummary, getDaily, getCampaignAds, analyzeAll, analyzeCampaign, exportCsv, sendReport. Tipler: Campaign, AccountSummary, DailyData, Ad.

### 2.3 Dokümantasyon

- README: Kurulum, Meta/Gemini/Claude/SMTP, proje yapısı, endpoint listesi.
- docs/: SOFTWARE_FEATURES_AND_ARCHITECTURE, IMPLEMENTATION_PHASES, NEXT_LEVEL_FEATURES, PROMPT_FOR_CLAUDE_CODE, PROJECT_SUMMARY_FOR_AI, WHATSAPP_INTEGRATION, NEXT_STEPS_AFTER_ENV.
- .gitignore: venv, .env, node_modules, .next.

---

## 3. Eksik veya Kısmen Yapılanlar

| Madde | Açıklama | Faz (plan) |
|-------|----------|------------|
| **CORS ortam değişkeni** | Şu an `main.py` içinde sabit origin listesi. `config.py` + `CORS_ORIGINS` env ile yapılması planlandı. | Faz 1 |
| **Production hata mesajı** | API hatalarında production’da detay gizleme, sadece genel mesaj + log (merkezi exception handler veya router bazlı). | Faz 1 |
| **Analitik sayfası gelişmiş** | Metrik seçici, kampanyalar arası karşılaştırma grafiği (Faz 2 hedefi). Şu an temel özet + günlük trend var. | Faz 2 |
| **Raporlar sayfası tam** | Rapor türleri, zamanlanmış rapor (Faz 3). Şu an CSV + e-posta formu var. | Faz 3 |
| **Ayarlar kalıcı** | Backend endpoint ile ayar kaydetme/okuma; frontend formun buna bağlanması. | Faz 4 |
| **Çoklu hesap** | Hesap seçici UI, API’de `ad_account_id` parametresi. | Faz 5 |
| **Production & güvenlik** | Rate limit, token/izin dokümantasyonu. | Faz 6 |
| **AI tahmin + “Uygula”** | Tahmin kartları, uyarılar, öneri listesi, bütçe/duraklat aksiyonları. | Faz 7 |
| **Panelden reklam oluşturma** | Kampanya → Reklam seti → Kreatif sihirbazı, medya yükleme, yayınlama. | Faz 8 |
| **WhatsApp** | Rapor/uyarı gönderimi, basit bot; backend + env. | Ayrı plan (WHATSAPP_INTEGRATION.md) |

---

## 4. Ortam ve Çalıştırma

- **Backend:** `backend/.env` — `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` (zorunlu Meta verisi için). `GEMINI_API_KEY` veya `ANTHROPIC_API_KEY`, `AI_PROVIDER`. SMTP (e-posta raporu için). `.env.example` proje kökünde.
- **Frontend:** `NEXT_PUBLIC_API_URL` (varsayılan http://localhost:8000).
- **Çalıştırma:** Backend: `uvicorn app.main:app --reload --port 8000`. Frontend: `npm run dev` (3000/3001).

System User token kullanıyorsanız süresiz; Graph API Explorer kısa süreli token’da 1 saat sonra veri kesilir, 503 veya boş veri görülebilir.

---

## 5. Sıradaki Adımlar (Öncelik Önerisi)

1. **Kısa vadede:** CORS’u `CORS_ORIGINS` env ile yapılandırmak ve (isteğe bağlı) production’da hata detayını gizlemek (Faz 1 tamamlama).
2. **Orta vadede:** Analitik sayfasında metrik seçici + kampanya karşılaştırma grafiği (Faz 2); ardından ayarların kalıcı olması (Faz 4).
3. **İleride:** Çoklu hesap (Faz 5), WhatsApp entegrasyonu (docs’taki plan), AI tahmin + “Uygula” (Faz 7).

---

## 6. Özet Cümle

Proje **çekirdek özellikleriyle çalışır durumda**: Meta’dan kampanya ve özet verisi alınıyor, dashboard ve kampanya sayfaları metrikleri güvenli gösteriyor, AI (Claude/Gemini) ve raporlama (CSV, e-posta) mevcut. Analitik ve Raporlar sayfaları 404 değil, temel içerikle açılıyor. Eksikler faz planına göre: CORS/hata yönetimi ince ayarı, gelişmiş analitik, kalıcı ayarlar, çoklu hesap ve üst seviye özellikler (AI uygulanabilir öneriler, panelden reklam oluşturma, WhatsApp).
