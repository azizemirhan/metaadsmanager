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
def _get_gemini_model() -> str:
    """Kullanıcının seçtiği Gemini modelini veya varsayılanı döndür."""
    return config.get_setting("AI_MODEL_GEMINI") or config.AI_PROVIDERS["gemini"]["default_model"]


def _gemini_analyze_campaigns(campaigns_data: list[dict]) -> str:
    import google.generativeai as genai
    genai.configure(api_key=config.get_setting("GEMINI_API_KEY") or "")
    model_name = _get_gemini_model()
    model = genai.GenerativeModel(model_name)
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
    model_name = _get_gemini_model()
    model = genai.GenerativeModel(model_name)
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
    model_name = _get_gemini_model()
    model = genai.GenerativeModel(model_name)
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
def _get_claude_model() -> str:
    """Kullanıcının seçtiği Claude modelini veya varsayılanı döndür."""
    return config.get_setting("AI_MODEL_CLAUDE") or config.AI_PROVIDERS["claude"]["default_model"]


def _claude_analyze_campaigns(campaigns_data: list[dict]) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=config.get_setting("ANTHROPIC_API_KEY") or "")
    model_name = _get_claude_model()
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
        model=model_name,
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
    model_name = _get_claude_model()
    message = client.messages.create(
        model=model_name,
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
    model_name = _get_claude_model()
    message = client.messages.create(
        model=model_name,
        max_tokens=1500,
        system="Sen bir Meta Ads raporlama uzmanısın. Haftalık performans raporlarını profesyonel ve anlaşılır şekilde özetliyorsun.",
        messages=[{
            "role": "user",
            "content": f"""Bu haftalık verilere göre yöneticiye göndermek için kısa ve öz bir rapor yaz:\n\n{json.dumps(data, ensure_ascii=False, indent=2)}\n\nRapor: haftalık özet, en iyi kampanya, dikkat alanı, 2-3 öneri. HTML formatında (e-posta için)."""
        }]
    )
    return message.content[0].text


# --- Ollama (self-hosted LLM) ---
def _get_ollama_model() -> str:
    """Kullanıcının seçtiği Ollama modelini veya varsayılanı döndür."""
    return config.get_setting("AI_MODEL_OLLAMA") or config.get_setting("OLLAMA_MODEL") or config.AI_PROVIDERS["ollama"]["default_model"]


def _ollama_generate(prompt: str, system: str = "") -> str:
    base = (config.get_setting("OLLAMA_BASE_URL") or "http://localhost:11434").rstrip("/")
    model = _get_ollama_model()
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
            model_name = _get_gemini_model()
            model = genai.GenerativeModel(model_name)
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
                            model=_get_claude_model(),
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


# --- Reklam özeti AI ile oluşturma ---
AD_SUMMARY_JSON_SCHEMA = """
{
  "campaignName": "string",
  "campaignObjective": "OUTCOME_AWARENESS | OUTCOME_TRAFFIC | OUTCOME_ENGAGEMENT | OUTCOME_LEADS | OUTCOME_SALES | OUTCOME_APP_PROMOTION | LINK_CLICKS | CONVERSIONS",
  "budgetStrategy": "campaign | adset",
  "budgetSharing": true,
  "bidStrategy": "highest_volume | lowest_cost | cost_cap",
  "abTestEnabled": false,
  "specialAdCategory": "" | "credit" | "employment" | "housing" | "social" | "politics",
  "adsetName": "string",
  "dailyBudget": 10000,
  "performanceGoal": "string",
  "conversionGoal": "MESSAGES | WEBSITE | CALLS | APP | PROFILE",
  "platforms": ["facebook", "instagram"],
  "placementsAuto": true,
  "location": "Türkiye",
  "ageMin": 18,
  "ageMax": 65,
  "gender": "all | male | female",
  "selectedDemographics": [],
  "selectedInterests": [],
  "selectedBehaviors": [],
  "targetingLogicWithin": "or | and",
  "targetingLogicBetween": "and | or",
  "creativeName": "string",
  "primaryText": "string",
  "headline": "string",
  "link": "https://...",
  "cta": "LEARN_MORE | SHOP_NOW | SIGN_UP | CONTACT_US | MESSAGE | CALL_NOW",
  "adName": "string",
  "welcomeMessage": "string",
  "faqQuestions": [{"q": "string", "a": "string"}]
}
"""


def _format_targeting_for_prompt(options: dict) -> str:
    """Hedef kitle seçeneklerini prompt için metne dönüştürür."""
    parts = []
    for cat, key in [("Demografik Bilgiler", "demographics"), ("İlgi Alanları", "interests"), ("Davranışlar", "behaviors")]:
        items = options.get(key) or []
        labels = [x.get("label", "").strip() for x in items if x.get("label") and "Kullanılamıyor" not in str(x.get("size", ""))]
        if labels:
            parts.append(f"### {cat} (sadece bu etiketlerden seç, aynen kopyala):\n" + "\n".join(f"- {l}" for l in labels[:300]))
        else:
            parts.append(f"### {cat}: (boş)")
    return "\n\n".join(parts)


def _generate_ad_summary_sync(
    user_context: str, analysis_texts: str, image_base64: str | None, targeting_options: dict | None = None
) -> dict:
    """Kullanıcı bağlamı ve rapor analizlerine göre reklam özeti JSON oluşturur."""
    targeting_block = ""
    if targeting_options:
        targeting_block = f"""
## MEVCUT HEDEF KITLE SEÇENEKLERİ (ZORUNLU - SADECE BUNLARDAN SEÇ):
Aşağıdaki listeler Meta - Demografik Bilgiler, İlgi Alanları ve Davranışlar dosyalarından alınmıştır.
selectedDemographics, selectedInterests, selectedBehaviors alanları için MUTLAKA bu listelerdeki etiketlerden seç.
Etiketleri BİREBİR, virgül/nokta farkı olmadan kopyala. Listede olmayan bir etiket ASLA yazma.

{_format_targeting_for_prompt(targeting_options)}
"""

    prompt = f"""Sen bir Meta Ads (Facebook & Instagram) uzmanısın. Kullanıcının reklam çıkacağı ürün/hizmet bilgisi ve mevcut performans raporlarına dayanarak eksiksiz, kaliteli bir reklam özeti oluştur.

## KULLANICI BAĞLAMI (Reklam çıkacağı ürün/hizmet):
{user_context}

## PERFORMANS RAPORLARI (Meta Ads analizleri):
{analysis_texts or "Rapor verisi yok."}
{targeting_block}

## GÖREV:
1. Kullanıcı bağlamı ve rapor verilerini dikkatlice analiz et.
2. Hedef kitle için: SADECE yukarıdaki mevcut hedef kitle listelerinden en uygun seçenekleri seç. Ürün/hizmete ve rapordaki performans verilerine göre kaliteli araştırma yap.
3. Her kategori için 2-6 arası en alakalı öğe seç (çok fazla seçim hedef kitleyi daraltır, çok az seçim ise yetersiz olur).
4. Sadece geçerli JSON döndür, başka metin ekleme.

## ÇIKTI ŞEMASI (bu formatta JSON döndür):
{AD_SUMMARY_JSON_SCHEMA}

## KURALLAR:
- campaignObjective: Etkileşim reklamı için OUTCOME_ENGAGEMENT
- conversionGoal: Mesaj/sohbet için MESSAGES, web trafiği için WEBSITE, arama için CALLS
- dailyBudget: kuruş (örn. 10000 = 100 TL)
- selectedDemographics, selectedInterests, selectedBehaviors: SADECE yukarıdaki listelerden, etiketleri BİREBİR kopyala
- primaryText: Reklam metni, ürün/hizmete uygun, çekici, max 125 karakter
- headline: Kısa başlık
- cta: MESSAGE (sohbet), CALL_NOW (arama), LEARN_MORE (web)
- Tüm string değerler Türkçe"""

    provider = _ai_provider()
    anthropic_key = config.get_setting("ANTHROPIC_API_KEY") or ""
    gemini_key = config.get_setting("GEMINI_API_KEY") or ""

    # Claude (resim destekli)
    if anthropic_key and provider != "gemini":
        try:
            import anthropic
            import base64
            client = anthropic.Anthropic(api_key=anthropic_key)
            content = [{"type": "text", "text": prompt}]
            if image_base64:
                try:
                    content.insert(0, {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": image_base64},
                    })
                except Exception:
                    pass
            message = client.messages.create(
                model=_get_claude_model(),
                max_tokens=4000,
                system="Sen Meta Ads uzmanısın. Sadece geçerli JSON döndür, başka açıklama yazma.",
                messages=[{"role": "user", "content": content}],
            )
            if message.content and len(message.content) > 0 and hasattr(message.content[0], "text"):
                text = message.content[0].text.strip()
                # JSON blokunu çıkar
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                return json.loads(text)
        except Exception as e:
            if gemini_key:
                pass  # Gemini'ye düş
            else:
                raise ValueError(f"Claude hatası: {e}") from e

    # Gemini (resim destekli)
    if gemini_key:
        try:
            import google.generativeai as genai
            import base64
            genai.configure(api_key=gemini_key)
            model_name = _get_gemini_model()
            model = genai.GenerativeModel(model_name)
            parts = [prompt]
            if image_base64:
                try:
                    import PIL.Image
                    import io
                    img_data = base64.b64decode(image_base64)
                    img = PIL.Image.open(io.BytesIO(img_data))
                    parts.insert(0, img)
                except Exception:
                    pass
            response = model.generate_content(parts)
            if response.candidates:
                part = response.candidates[0].content.parts[0] if response.candidates[0].content.parts else None
                if part and hasattr(part, "text"):
                    text = part.text.strip()
                    if "```json" in text:
                        text = text.split("```json")[1].split("```")[0].strip()
                    elif "```" in text:
                        text = text.split("```")[1].split("```")[0].strip()
                    return json.loads(text)
        except Exception as e:
            if anthropic_key:
                raise ValueError(f"Gemini hatası: {e}") from e
            raise

    raise ValueError("GEMINI_API_KEY veya ANTHROPIC_API_KEY tanımlı olmalı.")


async def generate_ad_summary_from_reports(
    user_context: str,
    analysis_texts: str,
    image_base64: str | None = None,
    targeting_options: dict | None = None,
) -> dict:
    """Rapor analizlerine ve kullanıcı bağlamına göre reklam özeti JSON üretir."""
    return await asyncio.to_thread(
        _generate_ad_summary_sync, user_context, analysis_texts, image_base64, targeting_options
    )
