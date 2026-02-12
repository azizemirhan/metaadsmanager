# WhatsApp Entegrasyonu — Yapılabilecek Tüm İşlemler

Bu belge, Meta Ads Dashboard projesine WhatsApp Business API entegrasyonu ile eklenebilecek tüm işlemleri ve senaryoları listeler.

---

## 1. Genel Bakış

- **WhatsApp Business API**, Meta (Facebook) ekosisteminin parçasıdır; mevcut Meta uygulamanıza ve (isteğe bağlı) Business Manager hesabınıza bağlanabilir.
- Proje zaten **Meta Marketing API** (reklam verisi) ve **e-posta raporu** kullandığı için, WhatsApp eklenerek rapor ve bildirimler aynı veri kaynağından WhatsApp’a da taşınabilir.
- Gerekli Meta izinleri: `whatsapp_business_management`, `whatsapp_business_messaging`.

---

## 2. Raporlama ve Özet Gönderimi

| İşlem | Açıklama |
|------|----------|
| **Haftalık özet** | Mevcut e-posta raporunun aynısı (veya kısaltılmışı) WhatsApp’a mesaj olarak gönderilir: toplam harcama, gösterim, tıklama, CTR, en iyi/düşük performanslı kampanyalar. |
| **Günlük özet** | Her gün sabah veya akşam tek mesaj: dünkü harcama, tıklama, kampanya sayısı, AI’dan tek cümlelik değerlendirme. |
| **AI raporu WhatsApp’ta** | AI analiz çıktısı (değerlendirme, öneriler, bütçe tavsiyesi) metin veya özet halinde belirli numaralara gönderilir. |
| **Özelleştirilmiş periyot** | Kullanıcı “Son 7 gün özeti at” dediğinde veya zamanlanmış görevle belirli periyot için özetin WhatsApp’a iletilmesi. |

---

## 3. Uyarı ve Bildirimler

| İşlem | Açıklama |
|------|----------|
| **Bütçe eşiği** | Günlük veya toplam harcama belirlenen limiti aştığında anında WhatsApp bildirimi (örn. “Bugünkü harcama ₺X limitini aştı.”). |
| **Kampanya duraklatıldı** | Bir kampanya Meta tarafından veya kullanıcı tarafından duraklatıldığında bilgi mesajı. |
| **Performans uyarısı** | CTR veya ROAS belirli bir eşiğin altına düştüğünde uyarı (örn. “Kampanya X’in CTR’ı %0.5’in altına düştü.”). |
| **Hata bildirimi** | Meta API hatası, token süresi dolması veya hesap erişim sorunu olduğunda teknik ekibe veya yöneticiye WhatsApp ile bildirim. |
| **Hedef tamamlandı** | Örn. aylık harcama hedefi dolduğunda veya dönüşüm hedefi yaklaştığında bilgilendirme. |

---

## 4. Sohbet Tabanlı Sorgular (Basit Bot)

| İşlem | Açıklama |
|------|----------|
| **Bugünkü harcama** | Kullanıcı “Bugün ne kadar harcadık?” yazınca son 1 günlük toplam harcama cevabı. |
| **Kampanya listesi** | “Aktif kampanyalar” veya “En çok harcama yapan 5 kampanya” gibi komutlara kısa liste dönmek. |
| **Tek kampanya özeti** | Kampanya adı veya ID ile “X kampanyası nasıl?” sorusuna özet metrik + kısa AI yorumu. |
| **Dönem karşılaştırması** | “Bu hafta vs geçen hafta” gibi basit karşılaştırma metni. |
| **Rapor talep** | “Son 30 gün raporu at” → sistem hazır raporu (veya link) WhatsApp’a gönderir. |

Bu işlemler için backend’de bir **webhook** gerekir: gelen mesaj metni parse edilir, uygun API (kampanya/özet) çağrılır, cevap metni WhatsApp API ile geri gönderilir.

---

## 5. Reklam ve WhatsApp Birlikte Kullanım

| İşlem | Açıklama |
|------|----------|
| **Reklam–WhatsApp bağlantısı** | Meta’da “WhatsApp’a tıkla” reklamları zaten mevcut; bu projede reklam verisi (harcama, tıklama) dashboard’da görülüyor. WhatsApp API ile aynı panelden sohbet sayıları veya son mesajlar da raporlanabilir (Meta’nın ilgili API’leri kullanılarak). |
| **Tek rapor: Reklam + Sohbet** | Haftalık rapora “Bu hafta X reklam tıklaması, Y WhatsApp sohbeti açıldı” gibi satır eklemek. |
| **Otomatik karşılama** | Reklamdan gelen ilk mesajlara otomatik karşılama veya kısa bilgi mesajı (WhatsApp Business API ile). |

---

## 6. Ekip ve Müşteri İletişimi

| İşlem | Açıklama |
|------|----------|
| **Raporu ekibe gönder** | Haftalık/günlük raporu birden fazla numaraya (ekip üyeleri, müşteri) göndermek. Abone listesi backend veya ayarlar sayfasında yönetilebilir. |
| **Rol bazlı içerik** | Yönetici tam özet, müşteri sadece özet KPI alabilir; aynı rapor akışında farklı mesaj şablonları. |
| **Onay / bilgilendirme** | Örn. bütçe değişikliği veya kampanya duraklatma öncesi “Onaylıyor musunuz?” sorusunu WhatsApp’tan gönderip (veya başka kanaldan) onay almak. |

---

## 7. Teknik Gereksinimler (Özet)

| Konu | Açıklama |
|------|----------|
| **Meta izinleri** | `whatsapp_business_management`, `whatsapp_business_messaging` (uygulamaya eklenmeli). |
| **WhatsApp Business hesabı** | Meta Business Manager üzerinden WhatsApp Business hesabı ve telefon numarası (onaylı). |
| **Backend** | Yeni servis (örn. `whatsapp_service.py`), mesaj gönderme fonksiyonları, isteğe bağlı webhook endpoint’i (gelen mesajları işlemek için). |
| **API** | WhatsApp Cloud API (Meta’nın resmi host’u) veya bir BSP (Business Solution Provider) üzerinden mesaj gönderimi. |
| **Güvenlik** | Alıcı numaraları ve izinler; KVKK/GDPR’a uygun saklama ve onay. |

---

## 8. Önceliklendirme Önerisi

1. **Faz 1 — Rapor gönderimi:** Haftalık (veya günlük) özeti WhatsApp’a gönder; mevcut e-posta raporu akışına paralel.
2. **Faz 2 — Uyarılar:** Bütçe eşiği ve kampanya durumu bildirimleri.
3. **Faz 3 — Basit bot:** “Bugünkü harcama?”, “En iyi 5 kampanya?” gibi komutlara yanıt (webhook gerekir).
4. **Faz 4 — Reklam + WhatsApp:** Sohbet sayıları ve tek rapor.
5. **Faz 5 — Çoklu alıcı / rol:** Ekip ve müşteri listesi, farklı içerik şablonları.

---

## 9. Bu Belgenin Kullanımı

- Ürün/özellik planlaması: Hangi WhatsApp özelliğinin önce geleceğine karar vermek.
- Geliştirme: Her işlem için backend’de endpoint/servis ve (gerekirse) frontend ayarlarının tasarlanması.
- Dokümantasyon: Müşteri veya ekip için “WhatsApp ile neler yapılıyor?” sorusunun cevabı.

Detaylı implementasyon adımları (kod, env değişkenleri, webhook URL) proje ilerledikçe bu dosyaya veya ayrı bir `WHATSAPP_IMPLEMENTATION.md` dosyasına eklenebilir.
