# Claude Code ile Faz Faz Uygulama — Prompt

Bu dosyadaki metni **Claude Code** (veya Cursor/benzeri bir AI kod asistanı) ile konuşurken kullan. Her fazı ayrı bir konuşmada veya aynı konuşmada sırayla “Faz X’i uygula” diyerek tetikleyebilirsin.

---

## Ana prompt (konuşmanın başında bir kez yapıştır)

Aşağıdaki metni **ilk mesajda** veya **yeni bir faz başlatırken** yapıştır:

```
Bu proje Meta Ads Dashboard: Next.js 14 (frontend) + FastAPI (backend) + Meta Marketing API + Claude (Anthropic). Proje kökünde backend/ ve frontend/ var; tüm dokümantasyon docs/ klasöründe.

Faz faz geliştirme yapıyorum. Her fazın detaylı yapılacaklar listesi ve kabul kriterleri docs/IMPLEMENTATION_PHASES.md dosyasında. Mimari ve özellikler docs/SOFTWARE_FEATURES_AND_ARCHITECTURE.md ve docs/NEXT_LEVEL_FEATURES.md dosyalarında.

Kurallar:
1. Sadece istediğim fazı uygula; o faz için IMPLEMENTATION_PHASES.md içindeki ilgili bölümü (Faz X — …) oku ve maddeleri eksiksiz uygula.
2. Mevcut kod yapısına, isimlendirmeye ve stile (Tailwind, React Query, FastAPI router’lar) uyumlu yaz; yeni dosya açarken projedeki benzer dosyaları referans al.
3. Backend Python 3.12, FastAPI; frontend TypeScript, Next.js App Router, src/app/ altında sayfalar ve components. API client frontend/src/app/lib/api.ts içinde.
4. Bir madde belirsizse IMPLEMENTATION_PHASES.md veya SOFTWARE_FEATURES_AND_ARCHITECTURE.md’den oku; kendi varsayımınla ek özellik ekleme.
5. İşin bitince kısa bir özet ver: hangi dosyalar eklendi/değişti, kabul kriterlerinden hangileri karşılanıyor.

Şimdi [FAZ NUMARASINI VE KISA ADINI YAZ] uygula. Önce docs/IMPLEMENTATION_PHASES.md dosyasındaki “Faz [X]” bölümünü oku, sonra adım adım kodla.
```

---

## Faz bazlı tetikleyici cümleler

Her satırı kopyalayıp **“Şimdi …”** kısmının yerine koyarak kullanabilirsin (veya doğrudan aşağıdaki kısa komutları yazabilirsin).

| Faz | Tetikleyici cümle (ana prompt’taki son cümleyi değiştir) |
|-----|----------------------------------------------------------|
| **Faz 1** | Şimdi **Faz 1 — Eksik sayfalar & temel düzeltmeler** uygula. Önce docs/IMPLEMENTATION_PHASES.md dosyasındaki “Faz 1” bölümünü oku, sonra: analytics ve reports placeholder sayfaları, backend config.py ve CORS, production hata gizleme, ai_service async. |
| **Faz 2** | Şimdi **Faz 2 — Analitik sayfası** uygula. IMPLEMENTATION_PHASES.md’deki Faz 2’yi oku; /analytics sayfasında periyot seçici, metrik seçici, kampanya karşılaştırma grafiği ve günlük trend grafiği ekle. |
| **Faz 3** | Şimdi **Faz 3 — Raporlar sayfası** uygula. IMPLEMENTATION_PHASES.md’deki Faz 3’ü oku; /reports sayfasında rapor türü, periyot, CSV indir ve e-posta ile gönder aksiyonlarını ekle. |
| **Faz 4** | Şimdi **Faz 4 — Ayarlar (kalıcı)** uygula. IMPLEMENTATION_PHASES.md’deki Faz 4’ü oku; Seçenek B (rehber): ayarlar sayfasında .env rehberi, “Kaydet” uyarısı, isteğe bağlı kopyala. |
| **Faz 5** | Şimdi **Faz 5 — Çoklu hesap** uygula. IMPLEMENTATION_PHASES.md’deki Faz 5’i oku; backend’de ad_account_id parametresi, hesap listesi endpoint’i; frontend’de AccountSwitcher, context, api.ts’e parametre ekleme. |
| **Faz 6** | Şimdi **Faz 6 — Production & güvenlik** uygula. IMPLEMENTATION_PHASES.md’deki Faz 6’yı oku; rate limit (opsiyonel), README’de production/CORS/token dokümantasyonu, opsiyonel health check. |
| **Faz 7** | Şimdi **Faz 7 — AI tahmin + panelden uygulanabilir öneriler** uygula. IMPLEMENTATION_PHASES.md’deki Faz 7’yi ve docs/NEXT_LEVEL_FEATURES.md’yi oku; tahmin/uyarı endpoint’leri, kampanya/ad set status ve bütçe PATCH, frontend tahmin kartı ve öneri listesi “Uygula” aksiyonları. |
| **Faz 8** | Şimdi **Faz 8 — Panelden reklam oluşturma ve yayınlama** uygula. IMPLEMENTATION_PHASES.md’deki Faz 8’i ve docs/NEXT_LEVEL_FEATURES.md’yi oku; backend’de kampanya/ad set/creative/ad oluşturma ve medya yükleme (Meta API); frontend’de sihirbaz (Kampanya → Reklam seti → Kreatif + Reklam → Yayınla). |

---

## Kısa komut (tek cümle)

Sadece şunu yazmak da yeterli olabilir (önce ana prompt’u bir kez yapıştırdıysan):

- “Faz 1’i uygula.”
- “Faz 2’yi uygula.”
- “Faz 7’yi uygula.”
- “IMPLEMENTATION_PHASES.md’deki Faz 8’i uygula.”

---

## İngilizce versiyon (Claude Code İngilizce kullanıyorsan)

```
This project is Meta Ads Dashboard: Next.js 14 (frontend) + FastAPI (backend) + Meta Marketing API + Claude (Anthropic). Repo has backend/ and frontend/; all docs are in docs/.

I'm implementing it phase by phase. Each phase's tasks and acceptance criteria are in docs/IMPLEMENTATION_PHASES.md. Architecture and features are in docs/SOFTWARE_FEATURES_AND_ARCHITECTURE.md and docs/NEXT_LEVEL_FEATURES.md.

Rules:
1. Implement only the phase I ask for. Read that phase's section in IMPLEMENTATION_PHASES.md and implement every item.
2. Match existing code structure, naming, and style (Tailwind, React Query, FastAPI routers). Use existing files as reference for new ones.
3. Backend: Python 3.12, FastAPI. Frontend: TypeScript, Next.js App Router, pages under src/app/. API client: frontend/src/app/lib/api.ts.
4. If something is unclear, read IMPLEMENTATION_PHASES.md or SOFTWARE_FEATURES_AND_ARCHITECTURE.md; don't add features not in the spec.
5. When done, briefly list: which files were added/changed, and which acceptance criteria are met.

Now implement Phase [N]. First read the "Faz [N]" / "Phase [N]" section in docs/IMPLEMENTATION_PHASES.md, then implement step by step.
```

Then: "Implement Phase 1." / "Implement Phase 7." etc.

---

## Not

- Her fazı bitirdikten sonra projeyi çalıştırıp (örn. `docker-compose up` veya backend + frontend ayrı) ilgili sayfaları ve API’leri test etmek iyi olur.
- Faz 7 ve Faz 8 için Meta API’de `ads_management` (ve ilgili) izinleri ve geçerli token gerekir; geliştirme ortamında test token’ı kullan.
