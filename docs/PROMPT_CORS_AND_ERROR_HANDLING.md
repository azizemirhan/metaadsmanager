# Prompt: CORS (env) + Production’da Hata Detayını Gizleme

Aşağıdaki metni Claude’a (veya başka bir AI’ya) **tamamen kopyalayıp yapıştır**; bu projede CORS’u ortam değişkeninden okuyacak ve production’da hata detayını gizleyecek değişiklikleri yapmasını isteyebilirsin.

---

## Kopyala-yapıştır prompt (Türkçe)

```
Bu proje bir Meta Ads Dashboard: backend FastAPI (Python), frontend Next.js. Şu iki işi yap:

---

1) CORS'u ortam değişkeninden oku

- backend/app/config.py oluştur:
  - ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
  - CORS_ORIGINS: os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001") değerini virgülle split edip liste yap (boşlukları strip et). Varsayılan olarak mevcut localhost origin'leri kalsın.
- backend/app/main.py güncelle: config'i import et, CORSMiddleware allow_origins=config.CORS_ORIGINS kullan (sabit liste kaldırılsın).
- Proje kökünde .env.example varsa CORS_ORIGINS ve ENVIRONMENT satırları ekle. Örnek: CORS_ORIGINS=http://localhost:3000  ve  ENVIRONMENT=development. Production için yorum: https://yourdomain.com eklenebilir.
- README.md içinde "Ortam değişkenleri" veya kurulum bölümüne kısaca CORS_ORIGINS ve ENVIRONMENT açıklaması ekle.

Kabul: Backend CORS_ORIGINS env ile çalışsın; değer verilmezse yukarıdaki localhost listesi kullanılsın.

---

2) Production'da hata detayını gizle

- config.py içinde IS_PRODUCTION = (os.getenv("ENVIRONMENT") == "production") ekle.
- backend/app/main.py içinde merkezi exception handler ekle:
  - @app.exception_handler(Exception) ile tüm yakalanmamış exception'ları yakala.
  - logging.exception(e) veya logger.error ile gerçek hatayı logla.
  - Eğer IS_PRODUCTION ise response'da status_code=500 ve detail="Bir hata oluştu" (veya benzeri sabit Türkçe mesaj) dön.
  - Development'ta (IS_PRODUCTION False) detail=str(e) ile detay dönebilirsin.
  - HTTPException zaten fırlatılmışsa onun status_code ve detail'ini kullan; sadece production'da detail'i genel mesaja çevir (örn. "Bir hata oluştu").

Kabul: Production'da (ENVIRONMENT=production) API hata cevabında kullanıcıya sadece genel mesaj gider; detay sadece sunucu logunda görünsün.

---

Özet: config.py (ENVIRONMENT, CORS_ORIGINS, IS_PRODUCTION), main.py (CORS config'den, exception handler), .env.example ve README güncellemesi. Başka dosyada değişiklik gerekmiyorsa sadece bu dosyaları değiştir.
```

---

## İsteğe bağlı: Proje bağlamı

Claude’a projeyi tanıtmak istersen, promptun **başına** şunu ekleyebilirsin:

```
Proje: Meta Ads Dashboard. Backend: FastAPI (backend/app/main.py, routers: campaigns, reports, ai_analysis, email_reports). Frontend: Next.js, API_BASE http://localhost:8000. Backend'de şu an CORS allow_origins sabit liste; hata durumunda detay client'a gidiyor. Aşağıdaki iki görevi uygula:
```

Ardından yukarıdaki “1) CORS’u ortam değişkeninden oku” ve “2) Production’da hata detayını gizle” bölümlerini olduğu gibi yapıştır.
