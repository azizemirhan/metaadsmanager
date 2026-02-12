# Token'ları Ekledikten Sonra Yapılacaklar

## 1. Backend'i yeniden başlat

`.env` değişince çalışan backend eski değerleri kullanır. Yeniden başlat:

```bash
cd backend
source venv/bin/activate   # Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

(Eğer `--reload` ile çalışıyorsa bazen .env değişikliği yeterli olmayabilir; bir kez Ctrl+C ile durdurup tekrar başlat.)

## 2. Frontend'i aç

```bash
cd frontend
npm run dev
```

Tarayıcıda: **http://localhost:3000** (veya 3001)

## 3. Kontrol et

- **Dashboard:** Genel bakış, KPI kartları, günlük grafik ve kampanya listesi gerçek veriyle gelmeli.
- **Kampanyalar:** Tüm kampanyalar listelenmeli.
- **Analitik / Raporlar:** Aynı veriyle çalışır.

## 4. Hata alırsan

- **503 / "Meta API hatası":** Token süresi dolmuş veya izinler eksik olabilir. Graph API Explorer’dan yeni token al; izinlerde `ads_read`, `ads_management`, `business_management` olsun.
- **Boş veri:** Hesapta seçilen tarih aralığında kampanya/veri olmayabilir; periyodu 90 güne çıkarıp dene.

## 5. Token süresi

Graph API Explorer’dan alınan token genelde **kısa süreli** (birkaç saat). Uzun süreli token için:
- https://developers.facebook.com/tools/accesstoken/
- veya Business Manager → System Users ile kalıcı token.
