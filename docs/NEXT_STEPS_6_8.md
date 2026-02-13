# Sıradaki Adımlar (6–8 ve WhatsApp)

Önceki 5 adım (Analitik, Raporlar, Ayarlar kalıcı, Çoklu hesap, Production) tamamlandı. Aşağıdaki adımlar uygulama önceliğine göre sıralanabilir.

---

## Özet

| # | Adım | Kısa açıklama | Zorluk | Tahmini süre |
|---|------|----------------|--------|----------------|
| **6** | WhatsApp entegrasyonu | Rapor/uyarı WhatsApp’a gönderim, basit bot | Orta | 2–3 gün |
| **7** | AI tahmin + “Uygula” | Tahmin kartları, uyarılar, öneri listesi, bütçe/duraklat aksiyonları | Yüksek | 2–3 gün |
| **8** | Panelden reklam oluşturma | Kampanya → Reklam seti → Kreatif sihirbazı, medya yükleme, “Yayınla” | Yüksek | 3–4 gün |

---

## Adım 6 — WhatsApp entegrasyonu

**Hedef:** Rapor ve uyarıları WhatsApp’a göndermek; isteğe bağlı basit komut botu.

**Yapılacaklar:**
- **Backend:** WhatsApp Cloud API (veya BSP) ile mesaj gönderme servisi; `whatsapp_service.py`, env: `WHATSAPP_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN` (veya Meta token + izinler).
- **Rapor:** Mevcut haftalık/günlük özeti metin olarak belirli numaralara gönderme (zamanlanmış veya “Gönder” butonu).
- **Uyarı:** Bütçe eşiği, kampanya duraklatma vb. için anlık bildirim.
- **Opsiyonel — Bot:** Webhook endpoint; “Bugünkü harcama?” gibi komutlara kısa yanıt.

**Referans:** `docs/WHATSAPP_INTEGRATION.md`

---

## Adım 7 — AI tahmin + panelden uygulanabilir öneriler (Faz 7)

**Hedef:** Tahmin ve uyarıları göstermek; AI önerilerini “Uygula” ile bütçe güncelleme veya kampanya duraklatma/başlatma.

**Yapılacaklar:**
- **Backend:**  
  - Tahmin: `GET /api/ai/forecast?days=30` (harcama tahmini).  
  - Uyarılar: `GET /api/ai/anomalies` veya `GET /api/alerts` (sapma listesi).  
  - Aksiyon: `PATCH /api/campaigns/{id}/status`, `PATCH /api/adsets/{id}/budget` (Meta API ile güncelleme).
- **Frontend:**  
  - Dashboard’da tahmin kartı; uyarılar listesi (Duraklat / Bütçe düşür / Kampanyaya git).  
  - AI Önerileri listesi ve her öneri için “Uygula” (bütçe formu veya onay).

**Referans:** `docs/IMPLEMENTATION_PHASES.md` (Faz 7), `docs/NEXT_LEVEL_FEATURES.md`

---

## Adım 8 — Panelden reklam oluşturma ve yayınlama (Faz 8)

**Hedef:** Panelde kampanya → reklam seti → kreatif + reklam sihirbazı; “Yayınla” ile Meta’da canlıya alma.

**Yapılacaklar:**
- **Backend:**  
  - `POST /api/campaigns` (kampanya oluştur).  
  - `POST /api/adsets` (reklam seti: bütçe, hedef kitle, tarih).  
  - Medya: `POST /api/creatives/upload-image`, `upload-video` → Meta’ya yükleme.  
  - `POST /api/creatives` (kreatif), `POST /api/ads` (reklam; status=ACTIVE ile yayınlama).
- **Frontend:** Çok adımlı sihirbaz (Kampanya seç/oluştur → Reklam seti → Görsel/video + metin + CTA → Özet → Yayınla).

**Referans:** `docs/IMPLEMENTATION_PHASES.md` (Faz 8), `docs/NEXT_LEVEL_FEATURES.md`

---

## Öncelik önerisi

1. **WhatsApp (Adım 6):** Bağımsız; rapor/uyarı için hızlı değer.
2. **Faz 7 (Adım 7):** Mevcut AI analizini “eyleme dönüştürür”; tahmin + uyarı + Uygula.
3. **Faz 8 (Adım 8):** En kapsamlı; reklam oluşturma ve yayınlama için tam akış.

Hangisiyle başlamak istediğinizi söylemeniz yeterli; o adım için detaylı görev listesi ve (isterseniz) implementasyon adımları çıkarılabilir.
