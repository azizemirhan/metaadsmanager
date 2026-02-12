import os
import json
import asyncio
from dotenv import load_dotenv

load_dotenv()

# Sağlayıcı seçimi: AI_PROVIDER=gemini | claude (yoksa GEMINI_API_KEY varsa gemini, yoksa claude)
AI_PROVIDER = os.getenv("AI_PROVIDER", "").lower().strip() or (
    "gemini" if os.getenv("GEMINI_API_KEY") else "claude"
)

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
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel("gemini-1.5-flash")
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
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel("gemini-1.5-flash")
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
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel("gemini-1.5-flash")
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
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
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
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
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
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
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


# --- Ortak async arayüz (thread ile bloklamayı önler) ---
async def analyze_campaigns(campaigns_data: list[dict]) -> str:
    if AI_PROVIDER == "gemini":
        return await asyncio.to_thread(_gemini_analyze_campaigns, campaigns_data)
    return await asyncio.to_thread(_claude_analyze_campaigns, campaigns_data)


async def analyze_single_campaign(campaign: dict) -> str:
    if AI_PROVIDER == "gemini":
        return await asyncio.to_thread(_gemini_analyze_single, campaign)
    return await asyncio.to_thread(_claude_analyze_single, campaign)


async def generate_weekly_report_text(data: dict) -> str:
    if AI_PROVIDER == "gemini":
        return await asyncio.to_thread(_gemini_weekly_report, data)
    return await asyncio.to_thread(_claude_weekly_report, data)
