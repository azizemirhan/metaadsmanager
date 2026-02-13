# -*- coding: utf-8 -*-
"""15 rapor şablonu tanımı ve şablona göre veri üretimi."""

from typing import Any, Optional

# Şablon listesi: id, başlık, kırılım açıklaması, metrik açıklaması
REPORT_TEMPLATES = [
    {
        "id": "template_1",
        "title": "Hangi hizmet en düşük maliyetle sonuç üretiyor?",
        "breakdown": "Kampanya Adı",
        "metrics": "Harcanan Tutar, Sonuçlar, Sonuç Başına Ücret",
        "data_source": "campaigns",
        "csv_columns": ["Kampanya Adı", "Harcanan Tutar", "Sonuçlar", "Sonuç Başına Ücret", "Durum"],
    },
    {
        "id": "template_2",
        "title": "Hangi platform (Facebook / Instagram) daha iyi dönüşüm sağlıyor?",
        "breakdown": "Platform",
        "metrics": "Sonuçlar, Harcanan Tutar, CTR (Tümü)",
        "data_source": "breakdown",
        "breakdown_param": "publisher_platform",
        "csv_columns": ["Platform", "Sonuçlar", "Harcanan Tutar", "CTR", "Gösterim", "Tıklama"],
    },
    {
        "id": "template_3",
        "title": "Hangi yaş grubu reklamlarla en çok etkileşime giriyor?",
        "breakdown": "Yaş",
        "metrics": "Tıklamalar (Tümü), CTR (Tümü), Sonuç Başına Ücret",
        "data_source": "breakdown",
        "breakdown_param": "age",
        "csv_columns": ["Yaş", "Tıklama", "CTR", "Sonuç Başına Ücret", "Harcanan Tutar", "Sonuçlar"],
    },
    {
        "id": "template_4",
        "title": "Cinsiyet bazında performans farkı var mı?",
        "breakdown": "Cinsiyet",
        "metrics": "Erişim, Sonuçlar, Harcanan Tutar",
        "data_source": "breakdown",
        "breakdown_param": "gender",
        "csv_columns": ["Cinsiyet", "Erişim", "Sonuçlar", "Harcanan Tutar", "Gösterim", "Tıklama"],
    },
    {
        "id": "template_5",
        "title": "Hangi reklam kreatifi (görsel/video/slayt) en iyi performansı gösteriyor?",
        "breakdown": "Reklam Kreatifi",
        "metrics": "CTR (Tümü), Sonuçlar, CPM",
        "data_source": "ads",
        "csv_columns": ["Reklam Adı", "CTR", "Sonuçlar", "CPM", "Harcanan Tutar", "Gösterim", "Tıklama"],
    },
    {
        "id": "template_6",
        "title": "Hangi reklam alanı (Feed, Reels, Stories vb.) en verimli?",
        "breakdown": "Reklam Alanı",
        "metrics": "Gösterim, Tıklamalar (Tümü), CPC, Sonuç Başına Ücret",
        "data_source": "breakdown",
        "breakdown_param": "platform_position",
        "csv_columns": ["Reklam Alanı", "Gösterim", "Tıklama", "CPC", "Sonuç Başına Ücret", "Harcanan Tutar"],
    },
    {
        "id": "template_7",
        "title": "Hangi cihazdan gelen kullanıcılar daha çok dönüşüyor?",
        "breakdown": "Gösterim Cihazı",
        "metrics": "Sonuçlar, Tıklamalar (Tümü), Harcanan Tutar",
        "data_source": "breakdown",
        "breakdown_param": "device_platform",
        "csv_columns": ["Cihaz", "Sonuçlar", "Tıklama", "Harcanan Tutar", "Gösterim", "CTR"],
    },
    {
        "id": "template_8",
        "title": "Zaman içinde performans nasıl değişiyor? (Hangi günler/haftalar daha iyi?)",
        "breakdown": "Gün",
        "metrics": "Harcanan Tutar, Sonuçlar, Sonuç Başına Ücret",
        "data_source": "daily",
        "csv_columns": ["Tarih", "Harcanan Tutar", "Sonuçlar", "Sonuç Başına Ücret", "Gösterim", "Tıklama", "CTR"],
    },
    {
        "id": "template_9",
        "title": "Hangi bölge/şehir en kaliteli kitleye sahip?",
        "breakdown": "Bölge",
        "metrics": "Erişim, Sonuçlar, Kalite Sıralaması, Dönüşüm Oranı Sıralaması",
        "data_source": "breakdown",
        "breakdown_param": "region",
        "csv_columns": ["Bölge", "Erişim", "Sonuçlar", "Harcanan Tutar", "Gösterim", "Tıklama", "CTR"],
    },
    {
        "id": "template_10",
        "title": "Reklam seti başına bütçe verimliliği nasıl?",
        "breakdown": "Reklam Seti Adı",
        "metrics": "Harcanan Tutar, Sonuçlar, Sonuç Başına Ücret, Yayın Durumu",
        "data_source": "adsets",
        "csv_columns": ["Reklam Seti Adı", "Harcanan Tutar", "Sonuçlar", "Sonuç Başına Ücret", "Yayın Durumu", "Kampanya ID"],
    },
    {
        "id": "template_11",
        "title": "Kalite & Alaka Düzeyi Ölçümleri",
        "breakdown": "Reklam / Kampanya",
        "metrics": "Kalite Sıralaması, Etkileşim Oranı Sıralaması, Dönüşüm Oranı Sıralaması",
        "data_source": "campaigns",
        "csv_columns": ["Kampanya Adı", "Harcanan Tutar", "CTR", "CPM", "ROAS", "Gösterim", "Tıklama", "Durum"],
    },
    {
        "id": "template_12",
        "title": "Video Performans Ölçümleri",
        "breakdown": "Reklam",
        "metrics": "%25'e Kadar Oynatma, %50, %75, %95",
        "data_source": "ads",
        "csv_columns": ["Reklam Adı", "Harcanan Tutar", "Gösterim", "Tıklama", "CTR", "CPM", "Sonuçlar"],
    },
    {
        "id": "template_13",
        "title": "Mesajlaşma Ölçümleri",
        "breakdown": "Kampanya",
        "metrics": "Yeni Mesajlaşma Kişileri, Mesajlaşma Başına Ücret, Başlatılan Konuşmalar",
        "data_source": "campaigns",
        "csv_columns": ["Kampanya Adı", "Harcanan Tutar", "Sonuçlar", "Gösterim", "Tıklama", "CTR"],
    },
    {
        "id": "template_14",
        "title": "Etkileşim Derinliği Ölçümleri",
        "breakdown": "Kampanya",
        "metrics": "Gönderi Etkileşimleri, Paylaşımlar, Kaydetme",
        "data_source": "campaigns",
        "csv_columns": ["Kampanya Adı", "Harcanan Tutar", "Gösterim", "Tıklama", "CTR", "Erişim", "Sonuçlar"],
    },
    {
        "id": "template_15",
        "title": "Maliyet Verimliliği Ölçümleri",
        "breakdown": "Kampanya",
        "metrics": "CPM, CPC, Harcanan Tutar, CTR",
        "data_source": "campaigns",
        "csv_columns": ["Kampanya Adı", "CPM", "CPC", "Harcanan Tutar", "CTR", "Gösterim", "Tıklama", "ROAS"],
    },
]


def _extract_conversions(actions: list) -> int:
    if not actions:
        return 0
    total = 0
    for a in actions:
        if a.get("action_type") in ("purchase", "lead", "complete_registration", "onsite_conversion.post_save", "omni_view_content"):
            total += int(a.get("value", 0))
    return total


def _row_campaign(row: dict) -> dict:
    spend = float(row.get("spend", 0) or 0)
    conv = int(row.get("conversions", 0) or 0)
    cost_per_result = round(spend / conv, 2) if conv else 0
    return {
        "Kampanya Adı": row.get("name", ""),
        "Harcanan Tutar": round(spend, 2),
        "Sonuçlar": conv,
        "Sonuç Başına Ücret": cost_per_result,
        "Durum": row.get("status", ""),
        "Gösterim": row.get("impressions", 0),
        "Tıklama": row.get("clicks", 0),
        "CTR": round(float(row.get("ctr", 0) or 0), 2),
        "CPM": round(float(row.get("cpm", 0) or 0), 2),
        "CPC": round(float(row.get("cpc", 0) or 0), 2),
        "ROAS": row.get("roas", 0),
        "Erişim": row.get("reach", 0),
    }


def _row_adset(row: dict) -> dict:
    spend = float(row.get("spend", 0) or 0)
    conv = int(row.get("conversions", 0) or 0)
    cost_per_result = round(spend / conv, 2) if conv else 0
    return {
        "Reklam Seti Adı": row.get("name", ""),
        "Harcanan Tutar": round(spend, 2),
        "Sonuçlar": conv,
        "Sonuç Başına Ücret": cost_per_result,
        "Yayın Durumu": row.get("status", ""),
        "Kampanya ID": row.get("campaign_id", ""),
    }


def _row_ad(row: dict) -> dict:
    return {
        "Reklam Adı": row.get("name", ""),
        "CTR": round(float(row.get("ctr", 0) or 0), 2),
        "Sonuçlar": row.get("conversions", 0),
        "CPM": round(float(row.get("cpm", 0) or 0), 2),
        "Harcanan Tutar": round(float(row.get("spend", 0) or 0), 2),
        "Gösterim": row.get("impressions", 0),
        "Tıklama": row.get("clicks", 0),
    }


def _row_daily(row: dict) -> dict:
    actions = row.get("actions") or []
    conv = _extract_conversions(actions)
    spend = float(row.get("spend", 0) or 0)
    cost_per_result = round(spend / conv, 2) if conv else 0
    return {
        "Tarih": row.get("date_start", ""),
        "Harcanan Tutar": round(spend, 2),
        "Sonuçlar": conv,
        "Sonuç Başına Ücret": cost_per_result,
        "Gösterim": row.get("impressions", 0),
        "Tıklama": row.get("clicks", 0),
        "CTR": round(float(row.get("ctr", 0) or 0), 2),
    }


def _row_breakdown(row: dict, breakdown_key: str) -> dict:
    """Breakdown API yanıt satırını ortak sütunlara çevirir."""
    key_val = row.get(breakdown_key, row.get("breakdown_key", ""))
    actions = row.get("actions") or []
    conv = _extract_conversions(actions)
    spend = float(row.get("spend", 0) or 0)
    cost_per_result = round(spend / conv, 2) if conv else 0
    label_map = {
        "publisher_platform": "Platform",
        "age": "Yaş",
        "gender": "Cinsiyet",
        "platform_position": "Reklam Alanı",
        "device_platform": "Cihaz",
        "region": "Bölge",
    }
    first_col = label_map.get(breakdown_key, breakdown_key)
    out = {
        first_col: key_val,
        "Harcanan Tutar": round(spend, 2),
        "Sonuçlar": conv,
        "Sonuç Başına Ücret": cost_per_result,
        "Gösterim": row.get("impressions", 0),
        "Tıklama": row.get("clicks", 0),
        "CTR": round(float(row.get("ctr", 0) or 0), 2),
        "CPC": round(float(row.get("cpc", 0) or 0), 2),
        "CPM": round(float(row.get("cpm", 0) or 0), 2),
        "Erişim": row.get("reach", 0),
    }
    return out


async def get_report_data_for_template(
    template_id: str,
    days: int,
    account_id: Optional[str],
    meta_service: Any,
) -> list[dict]:
    """Şablon ID ve tarih aralığına göre rapor satırlarını döndürür."""
    t = next((x for x in REPORT_TEMPLATES if x["id"] == template_id), None)
    if not t:
        return []

    src = t.get("data_source")
    if src == "campaigns":
        campaigns = await meta_service.get_campaigns(days, account_id=account_id)
        return [_row_campaign(c) for c in campaigns]
    if src == "adsets":
        adsets = await meta_service.get_ad_sets_with_insights(days, account_id=account_id)
        return [_row_adset(a) for a in adsets]
    if src == "ads":
        ads = await meta_service.get_ads(days=days, account_id=account_id)
        return [_row_ad(ad) for ad in ads]
    if src == "daily":
        daily = await meta_service.get_daily_breakdown(days, account_id=account_id)
        return [_row_daily(d) for d in daily]
    if src == "breakdown":
        param = t.get("breakdown_param", "publisher_platform")
        data = await meta_service.get_insights_with_breakdown(
            account_id=account_id, days=days, breakdowns=param
        )
        return [_row_breakdown(r, param) for r in data]
    return []


def get_template_csv_columns(template_id: str) -> list[str]:
    """Şablonun CSV sütun sırasını döndürür."""
    t = next((x for x in REPORT_TEMPLATES if x["id"] == template_id), None)
    return (t.get("csv_columns") or []) if t else []
