import os
import json
import asyncio
import httpx
from decimal import Decimal
from datetime import date, datetime
from dotenv import load_dotenv
from app import config

load_dotenv()


def _json_serial(obj):
    """JSON'da serilemeyen tipleri (Decimal, datetime) dönüştür."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(repr(obj) + " is not JSON serializable")


def _ai_provider() -> str:
    """claude | gemini | ollama | rule_based. Varsayılan: Claude (anahtar varsa), yoksa Gemini, yoksa rule_based."""
    p = (config.get_setting("AI_PROVIDER") or "").lower().strip()
    if p in ("claude", "gemini", "ollama", "rule_based"):
        return p
    if p:
        return p
    if config.get_setting("ANTHROPIC_API_KEY"):
        return "claude"
    if config.get_setting("GEMINI_API_KEY"):
        return "gemini"
    return "rule_based"

SYSTEM_PROMPT = """Sen bir Meta Ads (Facebook & Instagram Reklam) uzmanısın. 
Reklam verilerini analiz edip Türkçe olarak somut, uygulanabilir öneriler veriyorsun.

Analiz yaparken şunlara dikkat et:
- CTR < %1 ise: Reklam kreatifi veya hedef kitle sorunu
- CPC çok yüksekse: Teklif stratejisi veya kalite puanı sorunu  
- ROAS < 2 ise: Karlılık riski, bütçe optimizasyonu gerekli
- Frequency > 3 ise: Reklam yorgunluğu riski
- CPM çok yüksekse: Hedef kitle çok dar veya rekabet yoğun

Her analizde şu formatta yanıt ver:
1. 📊 GENEL DEĞERLENDİRME
2. ✅ GÜÇLÜ YÖNLER 
3. ⚠️ DİKKAT EDİLMESİ GEREKENLER
4. 🎯 SOMUT ÖNERİLER (en az 5 madde)
5. 💰 BÜTÇE TAVSİYESİ"""


# --- Gemini ---
def _gemini_analyze_campaigns(campaigns_data: list[dict]) -> str:
    import google.generativeai as genai
    genai.configure(api_key=config.get_setting("GEMINI_API_KEY") or "")
    model = genai.GenerativeModel("gemini-2.0-flash")
    summary = []
    for c in campaigns_data[:20]:
        summary.append({
            "name": c.get("name", ""),
            "status": c.get("status", ""),
            "objective": c.get("objective", ""),
            "spend": c.get("spend", 0),
            "impressions": c.get("impressions", 0),
            "clicks": c.get("clicks", 0),
            "ctr": c.get("ctr", 0),
            "cpc": c.get("cpc", 0),
            "cpm": c.get("cpm", 0),
            "roas": c.get("roas", 0),
            "frequency": c.get("frequency", 0),
            "conversions": c.get("conversions", 0),
        })
    prompt = f"""{SYSTEM_PROMPT}

Aşağıdaki Meta Ads kampanya verilerini analiz et ve detaylı öneriler ver (Türkçe):

{json.dumps(summary, ensure_ascii=False, indent=2)}

Toplam {len(campaigns_data)} kampanya var. Lütfen kapsamlı bir analiz yap."""
    response = model.generate_content(prompt)
    return response.text


def _gemini_analyze_single(campaign: dict) -> str:
    import google.generativeai as genai
    genai.configure(api_key=config.get_setting("GEMINI_API_KEY") or "")
    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = f"""{SYSTEM_PROMPT}

Bu kampanyayı derinlemesine analiz et (Türkçe):

Kampanya Adı: {campaign.get('name')}
Durum: {campaign.get('status')}
Hedef: {campaign.get('objective')}
Harcama: {campaign.get('spend', 0):.2f} TL
Gösterim: {campaign.get('impressions', 0):,}
Tıklama: {campaign.get('clicks', 0):,}
CTR: %{campaign.get('ctr', 0):.2f}
CPC: {campaign.get('cpc', 0):.2f} TL
CPM: {campaign.get('cpm', 0):.2f} TL
ROAS: {campaign.get('roas', 0):.2f}x
Frequency: {campaign.get('frequency', 0):.1f}
Dönüşüm: {campaign.get('conversions', 0)}

Bu kampanya için özel optimizasyon önerileri ver."""
    response = model.generate_content(prompt)
    return response.text


def _gemini_weekly_report(data: dict) -> str:
    import google.generativeai as genai
    genai.configure(api_key=config.get_setting("GEMINI_API_KEY") or "")
    model = genai.GenerativeModel("gemini-2.0-flash")
    prompt = f"""Sen bir Meta Ads raporlama uzmanısın. Haftalık performans raporlarını profesyonel ve anlaşılır şekilde özetliyorsun (Türkçe).

Bu haftalık verilere göre yöneticiye göndermek için kısa ve öz bir rapor yaz:

{json.dumps(data, ensure_ascii=False, indent=2)}

Rapor şunları içermeli:
- Haftalık özet (2-3 cümle)
- En iyi performans gösteren kampanya
- Dikkat gerektiren alan
- Önümüzdeki hafta için 2-3 öneri

HTML formatında yaz (e-posta için)."""
    response = model.generate_content(prompt)
    return response.text


# --- Claude ---
def _claude_analyze_campaigns(campaigns_data: list[dict]) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=config.get_setting("ANTHROPIC_API_KEY") or "")
    summary = []
    for c in campaigns_data[:20]:
        summary.append({
            "name": c.get("name", ""),
            "status": c.get("status", ""),
            "objective": c.get("objective", ""),
            "spend": c.get("spend", 0),
            "impressions": c.get("impressions", 0),
            "clicks": c.get("clicks", 0),
            "ctr": c.get("ctr", 0),
            "cpc": c.get("cpc", 0),
            "cpm": c.get("cpm", 0),
            "roas": c.get("roas", 0),
            "frequency": c.get("frequency", 0),
            "conversions": c.get("conversions", 0),
        })
    message = client.messages.create(
        model="claude-opus-4-5-20251101",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"""Aşağıdaki Meta Ads kampanya verilerini analiz et ve detaylı öneriler ver:\n\n{json.dumps(summary, ensure_ascii=False, indent=2)}\n\nToplam {len(campaigns_data)} kampanya var. Lütfen kapsamlı bir analiz yap."""
        }]
    )
    return message.content[0].text


def _claude_analyze_single(campaign: dict) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=config.get_setting("ANTHROPIC_API_KEY") or "")
    message = client.messages.create(
        model="claude-opus-4-5-20251101",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"""Bu kampanyayı derinlemesine analiz et:\n\nKampanya Adı: {campaign.get('name')}\nDurum: {campaign.get('status')}\nHedef: {campaign.get('objective')}\nHarcama: {campaign.get('spend', 0):.2f} TL\nGösterim: {campaign.get('impressions', 0):,}\nTıklama: {campaign.get('clicks', 0):,}\nCTR: %{campaign.get('ctr', 0):.2f}\nCPC: {campaign.get('cpc', 0):.2f} TL\nCPM: {campaign.get('cpm', 0):.2f} TL\nROAS: {campaign.get('roas', 0):.2f}x\nFrequency: {campaign.get('frequency', 0):.1f}\nDönüşüm: {campaign.get('conversions', 0)}\n\nBu kampanya için özel optimizasyon önerileri ver."""
        }]
    )
    return message.content[0].text


def _claude_weekly_report(data: dict) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=config.get_setting("ANTHROPIC_API_KEY") or "")
    message = client.messages.create(
        model="claude-opus-4-5-20251101",
        max_tokens=1500,
        system="Sen bir Meta Ads raporlama uzmanısın. Haftalık performans raporlarını profesyonel ve anlaşılır şekilde özetliyorsun.",
        messages=[{
            "role": "user",
            "content": f"""Bu haftalık verilere göre yöneticiye göndermek için kısa ve öz bir rapor yaz:\n\n{json.dumps(data, ensure_ascii=False, indent=2)}\n\nRapor: haftalık özet, en iyi kampanya, dikkat alanı, 2-3 öneri. HTML formatında (e-posta için)."""
        }]
    )
    return message.content[0].text


# --- Ollama (self-hosted LLM) ---
def _ollama_generate(prompt: str, system: str = "") -> str:
    base = (config.get_setting("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
    model = config.get_setting("OLLAMA_MODEL") or "llama3.2"
    full_prompt = f"{system}\n\n{prompt}" if system else prompt
    try:
        with httpx.Client(timeout=120.0) as client:
            r = client.post(
                f"{base}/api/generate",
                json={"model": model, "prompt": full_prompt, "stream": False},
            )
            r.raise_for_status()
            data = r.json()
            return (data.get("response") or "").strip()
    except Exception as e:
        return f"Hata (Ollama): {e}. Ollama çalışıyor mu? OLLAMA_BASE_URL ve OLLAMA_MODEL doğru mu?"


def _ollama_analyze_campaigns(campaigns_data: list[dict]) -> str:
    summary = []
    for c in campaigns_data[:20]:
        summary.append({
            "name": c.get("name", ""), "status": c.get("status", ""), "objective": c.get("objective", ""),
            "spend": c.get("spend", 0), "impressions": c.get("impressions", 0), "clicks": c.get("clicks", 0),
            "ctr": c.get("ctr", 0), "cpc": c.get("cpc", 0), "cpm": c.get("cpm", 0),
            "roas": c.get("roas", 0), "frequency": c.get("frequency", 0), "conversions": c.get("conversions", 0),
        })
    prompt = f"""Aşağıdaki Meta Ads kampanya verilerini analiz et ve Türkçe detaylı öneriler ver:

{json.dumps(summary, ensure_ascii=False, indent=2)}

Toplam {len(campaigns_data)} kampanya. Yanıt: 1) Genel değerlendirme 2) Güçlü yönler 3) Dikkat edilmesi gerekenler 4) Somut öneriler (en az 5 madde) 5) Bütçe tavsiyesi."""
    return _ollama_generate(prompt, system=SYSTEM_PROMPT)


def _ollama_analyze_single(campaign: dict) -> str:
    prompt = f"""Bu kampanyayı derinlemesine analiz et (Türkçe):

Kampanya: {campaign.get('name')} | Durum: {campaign.get('status')} | Hedef: {campaign.get('objective')}
Harcama: {campaign.get('spend', 0):.2f} TL | Gösterim: {campaign.get('impressions', 0):,} | Tıklama: {campaign.get('clicks', 0):,}
CTR: %{campaign.get('ctr', 0):.2f} | CPC: {campaign.get('cpc', 0):.2f} TL | CPM: {campaign.get('cpm', 0):.2f} TL
ROAS: {campaign.get('roas', 0):.2f}x | Frequency: {campaign.get('frequency', 0):.1f} | Dönüşüm: {campaign.get('conversions', 0)}

Bu kampanya için özel optimizasyon önerileri ver."""
    return _ollama_generate(prompt, system=SYSTEM_PROMPT)


def _ollama_weekly_report(data: dict) -> str:
    prompt = f"""Meta Ads haftalık veri. Yöneticiye kısa rapor yaz (Türkçe, HTML uygun):

{json.dumps(data, ensure_ascii=False, indent=2)}

İçerik: haftalık özet, en iyi kampanya, dikkat alanı, 2-3 öneri."""
    return _ollama_generate(prompt, system="Sen bir Meta Ads raporlama uzmanısın. Haftalık raporları özetliyorsun.")


def _ollama_analyze_report(report_name: str, template_title: str, prompt_common: str, data_str: str) -> str:
    full = prompt_common + "\n\nVeri:\n" + data_str
    return _ollama_generate(full, system="Sen bir Meta Ads veri analisti olarak rapor verisini Türkçe özetliyorsun ve öneri veriyorsun.")


# --- Kural tabanlı analiz (API yok) ---
def _rule_based_analyze_campaigns(campaigns_data: list[dict]) -> str:
    lines = ["1. GENEL DEĞERLENDİRME", f"Toplam {len(campaigns_data)} kampanya incelendi.", ""]
    strong, warnings, tips = [], [], []
    for c in campaigns_data[:30]:
        name = c.get("name", "?")[:40]
        ctr = float(c.get("ctr") or 0)
        roas = float(c.get("roas") or 0)
        freq = float(c.get("frequency") or 0)
        spend = float(c.get("spend") or 0)
        conv = int(c.get("conversions") or 0)
        if ctr >= 1.5 and roas >= 2:
            strong.append(f"- {name}: CTR %{ctr:.2f}, ROAS {roas:.2f}x — iyi performans.")
        if ctr > 0 and ctr < 1:
            warnings.append(f"- {name}: CTR düşük (%{ctr:.2f}). Kreatif veya hedef kitle gözden geçirilsin.")
        if roas > 0 and roas < 2:
            warnings.append(f"- {name}: ROAS düşük ({roas:.2f}x). Bütçe veya teklif stratejisi kontrol edilsin.")
        if freq > 3:
            warnings.append(f"- {name}: Frequency yüksek ({freq:.1f}). Reklam yorgunluğu riski; yeni kreatif düşünün.")
        if spend > 0 and conv == 0:
            tips.append(f"- {name}: Harcama var, dönüşüm yok. Dönüşüm izleme ve hedef kitle kontrol edilsin.")
    lines.append("2. GÜÇLÜ YÖNLER")
    lines.extend(strong if strong else ["- Belirgin güçlü kampanya tespit edilmedi."])
    lines.append("")
    lines.append("3. DİKKAT EDİLMESİ GEREKENLER")
    lines.extend(warnings[:10] if warnings else ["- Kritik uyarı yok."])
    lines.append("")
    lines.append("4. SOMUT ÖNERİLER")
    lines.append("- CTR %1 altındaki kampanyalarda kreatif veya hedef kitle testi yapın.")
    lines.append("- ROAS 2x altındakilerde bütçe azaltın veya teklif stratejisini gözden geçirin.")
    lines.append("- Frequency 3 üzerinde ise yeni reklam varyasyonları ekleyin.")
    lines.extend(tips[:5])
    lines.append("")
    lines.append("5. BÜTÇE TAVSİYESİ")
    lines.append("- Düşük ROAS/CTR kampanyalarda bütçe kısılabilir; güçlü kampanyalara kaydırın.")
    return "\n".join(lines)


def _rule_based_analyze_single(campaign: dict) -> str:
    name = campaign.get("name", "?")
    ctr = float(campaign.get("ctr") or 0)
    roas = float(campaign.get("roas") or 0)
    freq = float(campaign.get("frequency") or 0)
    lines = [f"Kampanya: {name}", ""]
    if ctr < 1:
        lines.append(f"CTR düşük (%{ctr:.2f}). Reklam kreatifi veya hedef kitle iyileştirmesi önerilir.")
    if roas < 2 and roas > 0:
        lines.append(f"ROAS {roas:.2f}x. Karlılık için bütçe veya teklif stratejisi gözden geçirilsin.")
    if freq > 3:
        lines.append(f"Frequency {freq:.1f}. Reklam yorgunluğu riski; yeni kreatif eklenebilir.")
    if ctr >= 1 and roas >= 2:
        lines.append("Genel performans iyi. Mevcut strateji sürdürülebilir.")
    lines.append("")
    lines.append("Öneri: Metrikleri haftalık takip edin; eşik aşımlarında bütçe/kreatif ayarı yapın.")
    return "\n".join(lines)


def _rule_based_analyze_report(report_name: str, template_title: str, rows: list, columns: list) -> str:
    col_str = ", ".join(str(c) for c in (columns or []))
    lines = [
        f"Rapor: {report_name} — Şablon: {template_title}",
        f"Veri: {len(rows)} satır. Sütunlar: {col_str}",
        "",
        "1. Özet: Tablo verisi kural tabanlı analiz ile özetlendi.",
        "2. Öneri: Sayısal sütunlarda en yüksek/düşük değerleri CSV üzerinden inceleyin.",
        "3. Detaylı dil tabanlı analiz için AI sağlayıcı olarak Claude, Gemini veya Ollama kullanın.",
    ]
    if rows:
        sample = rows[0]
        numeric_keys = [k for k in sample if isinstance(sample.get(k), (int, float))]
        if numeric_keys:
            lines.append(f"Sayısal alan örnekleri: {', '.join(numeric_keys[:8])}.")
    return "\n".join(lines)


# --- Ortak async arayüz (thread ile bloklamayı önler) ---
async def analyze_campaigns(campaigns_data: list[dict]) -> str:
    provider = _ai_provider()
    if provider == "gemini":
        return await asyncio.to_thread(_gemini_analyze_campaigns, campaigns_data)
    if provider == "ollama":
        return await asyncio.to_thread(_ollama_analyze_campaigns, campaigns_data)
    if provider == "rule_based":
        return await asyncio.to_thread(_rule_based_analyze_campaigns, campaigns_data)
    return await asyncio.to_thread(_claude_analyze_campaigns, campaigns_data)


async def analyze_single_campaign(campaign: dict) -> str:
    provider = _ai_provider()
    if provider == "gemini":
        return await asyncio.to_thread(_gemini_analyze_single, campaign)
    if provider == "ollama":
        return await asyncio.to_thread(_ollama_analyze_single, campaign)
    if provider == "rule_based":
        return await asyncio.to_thread(_rule_based_analyze_single, campaign)
    return await asyncio.to_thread(_claude_analyze_single, campaign)


async def generate_weekly_report_text(data: dict) -> str:
    provider = _ai_provider()
    if provider == "gemini":
        return await asyncio.to_thread(_gemini_weekly_report, data)
    if provider == "ollama":
        return await asyncio.to_thread(_ollama_weekly_report, data)
    if provider == "rule_based":
        return await asyncio.to_thread(
            lambda: "Haftalık rapor (kural tabanlı): Verilerinizi kampanya listesinden inceleyebilirsiniz. AI özeti için Claude, Gemini veya Ollama seçin."
        )
    return await asyncio.to_thread(_claude_weekly_report, data)


def _analyze_report_data_sync(report_name: str, template_title: str, rows: list, columns: list) -> str:
    """Rapor verisini (CSV benzeri tablo) AI ile analiz ettirir. Provider: ollama | rule_based | claude | gemini."""
    col_list = columns if columns else []
    col_str = ", ".join(str(c) for c in col_list)
    prompt_common = f"""Aşağıdaki Meta reklam rapor verisini analiz et. Rapor adı: "{report_name}". Şablon: "{template_title}".
Veri {len(rows)} satır ve şu sütunları içeriyor: {col_str}.
Türkçe olarak: 1) Özet bulgular 2) En iyi / en zayıf performans 3) Somut öneriler (en az 3 madde) yaz. Kısa ve öz olsun."""

    try:
        data_str = json.dumps(rows[:100], ensure_ascii=False, indent=0, default=_json_serial)
    except (TypeError, ValueError):
        data_str = json.dumps([{k: str(v) for k, v in row.items()} for row in rows[:100]], ensure_ascii=False, indent=0)

    provider = _ai_provider()
    if provider == "ollama":
        return _ollama_analyze_report(report_name, template_title, prompt_common, data_str)
    if provider == "rule_based":
        return _rule_based_analyze_report(report_name, template_title, rows, col_list)

    # Claude veya Gemini
    anthropic_key = config.get_setting("ANTHROPIC_API_KEY") or ""
    if anthropic_key and provider != "gemini":
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=anthropic_key)
            message = client.messages.create(
                model="claude-opus-4-5-20251101",
                max_tokens=2000,
                system="Sen bir Meta Ads veri analisti olarak rapor verisini Türkçe özetliyorsun ve öneri veriyorsun.",
                messages=[{"role": "user", "content": prompt_common + "\n\nVeri:\n" + data_str}],
            )
            if message.content and len(message.content) > 0 and hasattr(message.content[0], "text"):
                return message.content[0].text
        except Exception:
            pass  # Claude başarısız olursa aşağıda Gemini denenir veya hata mesajı

    # Gemini (eski SDK - 404 alınırsa önce Claude dene, olmazsa kural tabanlı analiz döndür)
    gemini_key = config.get_setting("GEMINI_API_KEY") or ""
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-2.0-flash")
            response = model.generate_content(prompt_common + "\n\nVeri:\n" + data_str)
            if response.candidates:
                part = response.candidates[0].content.parts[0] if response.candidates[0].content.parts else None
                if part and hasattr(part, "text"):
                    return part.text
        except Exception as e:
            err = str(e).lower()
            if "404" in err or "not found" in err:
                # Gemini model bulunamadı: Claude varsa dene, yoksa kural tabanlı analiz ver
                if anthropic_key:
                    try:
                        import anthropic
                        client = anthropic.Anthropic(api_key=anthropic_key)
                        message = client.messages.create(
                            model="claude-opus-4-5-20251101",
                            max_tokens=2000,
                            system="Sen bir Meta Ads veri analisti olarak rapor verisini Türkçe özetliyorsun ve öneri veriyorsun.",
                            messages=[{"role": "user", "content": prompt_common + "\n\nVeri:\n" + data_str}],
                        )
                        if message.content and len(message.content) > 0 and hasattr(message.content[0], "text"):
                            return message.content[0].text
                    except Exception:
                        pass
                # Claude yok veya başarısız: kural tabanlı analiz ile kullanıcıya en azından özet ver
                rule_result = _rule_based_analyze_report(report_name, template_title, rows, col_list)
                return rule_result + "\n\n*Not: Daha detaylı analiz için Ayarlar'dan AI sağlayıcı olarak Claude seçebilir veya ANTHROPIC_API_KEY ekleyebilirsiniz.*"

    if anthropic_key:
        return "Hata: Claude yanıt üretemedi."
    if gemini_key:
        return "Hata: Gemini kullanılamadı. ANTHROPIC_API_KEY ekleyerek Claude ile deneyin."
    return "Hata: .env dosyasında GEMINI_API_KEY veya ANTHROPIC_API_KEY tanımlı değil. Ayarlardan birini ekleyin."


async def analyze_report_data(report_name: str, template_title: str, rows: list[dict], columns: list) -> str:
    """Rapor verisini async olarak AI ile analiz ettirir."""
    return await asyncio.to_thread(_analyze_report_data_sync, report_name, template_title, rows, columns)
