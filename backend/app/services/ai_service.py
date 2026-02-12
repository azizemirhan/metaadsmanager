import anthropic
import asyncio
import os
import json
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

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


async def analyze_campaigns(campaigns_data: list[dict]) -> str:
    """Kampanya verilerini AI ile analiz et"""
    
    # Veriyi özetle (token tasarrufu için)
    summary = []
    for c in campaigns_data[:20]:  # Max 20 kampanya analiz et
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

    message = await asyncio.to_thread(
        client.messages.create,
        model="claude-opus-4-5-20251101",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"""Aşağıdaki Meta Ads kampanya verilerini analiz et ve detaylı öneriler ver:

{json.dumps(summary, ensure_ascii=False, indent=2)}

Toplam {len(campaigns_data)} kampanya var. Lütfen kapsamlı bir analiz yap."""
            }
        ]
    )

    return message.content[0].text


async def analyze_single_campaign(campaign: dict) -> str:
    """Tek kampanyayı derinlemesine analiz et"""
    message = await asyncio.to_thread(
        client.messages.create,
        model="claude-opus-4-5-20251101",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"""Bu kampanyayı derinlemesine analiz et:

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
            }
        ]
    )

    return message.content[0].text


async def generate_weekly_report_text(data: dict) -> str:
    """Haftalık e-posta raporu için metin oluştur"""
    message = await asyncio.to_thread(
        client.messages.create,
        model="claude-opus-4-5-20251101",
        max_tokens=1500,
        system="Sen bir Meta Ads raporlama uzmanısın. Haftalık performans raporlarını profesyonel ve anlaşılır şekilde özetliyorsun.",
        messages=[
            {
                "role": "user",
                "content": f"""Bu haftalık verilere göre yöneticiye göndermek için kısa ve öz bir rapor yaz:

{json.dumps(data, ensure_ascii=False, indent=2)}

Rapor şunları içermeli:
- Haftalık özet (2-3 cümle)
- En iyi performans gösteren kampanya
- Dikkat gerektiren alan
- Önümüzdeki hafta için 2-3 öneri

HTML formatında yaz (e-posta için)."""
            }
        ]
    )

    return message.content[0].text
