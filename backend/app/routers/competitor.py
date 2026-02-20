# -*- coding: utf-8 -*-
"""
Rakip Analizi API — Meta Ads Library'den reklamları çeker ve analiz eder.
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.ads_library_service import ads_library_service, AdsLibraryError

router = APIRouter(prefix="/api/competitor", tags=["Competitor"])


# ─── Endpoint'ler ──────────────────────────────────────────────────────────────

@router.get("/search")
async def search_competitor_ads(
    q: str = Query("", description="Arama terimi (boş bırakılabilir)"),
    countries: str = Query("TR", description="Ülke kodları, virgülle ayrılmış: TR,US"),
    ad_type: str = Query("ALL", description="ALL veya POLITICAL_AND_ISSUE_ADS"),
    active_status: str = Query("ALL", description="ALL, ACTIVE veya INACTIVE"),
    page_ids: str = Query("", description="Sayfa ID'leri, virgülle ayrılmış"),
    date_min: str = Query("", description="Başlangıç tarihi YYYY-MM-DD"),
    date_max: str = Query("", description="Bitiş tarihi YYYY-MM-DD"),
    limit: int = Query(25, ge=1, le=100),
):
    """
    Meta Ads Library'de reklam arar.
    Kendi Meta token'ınız üzerinden herkese açık rakip reklamlarını görüntüler.
    """
    country_list = [c.strip() for c in countries.split(",") if c.strip()]
    page_id_list = [p.strip() for p in page_ids.split(",") if p.strip()]

    try:
        result = await ads_library_service.search_ads(
            search_terms=q,
            countries=country_list,
            ad_type=ad_type,
            active_status=active_status,
            page_ids=page_id_list if page_id_list else None,
            date_min=date_min,
            date_max=date_max,
            limit=limit,
        )
        return result
    except AdsLibraryError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/page/{page_id}")
async def get_competitor_page(page_id: str):
    """Rakip sayfanın bilgilerini ve aktif reklam durumunu getirir."""
    try:
        info = await ads_library_service.get_page_info(page_id)
        ads_status = await ads_library_service.get_page_ads_count(page_id)
        return {**info, **ads_status}
    except AdsLibraryError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/analyze")
async def analyze_competitor(
    page_id: str = Query(..., description="Analiz edilecek rakip sayfa ID"),
    countries: str = Query("TR"),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Rakip sayfanın reklamlarını çeker ve basit analiz yapar:
    - Aktif reklam sayısı
    - En sık kullanılan CTA'lar
    - Reklam metni örüntüleri
    - Yayın tarihi dağılımı
    """
    country_list = [c.strip() for c in countries.split(",") if c.strip()]

    try:
        result = await ads_library_service.search_ads(
            page_ids=[page_id],
            countries=country_list,
            active_status="ALL",
            limit=limit,
        )
    except AdsLibraryError as e:
        raise HTTPException(status_code=503, detail=str(e))

    ads = result.get("ads", [])

    if not ads:
        return {
            "page_id": page_id,
            "total_ads": 0,
            "active_ads": 0,
            "inactive_ads": 0,
            "avg_body_length": 0,
            "common_keywords": [],
            "ads": [],
        }

    active = [a for a in ads if a.get("is_active")]
    inactive = [a for a in ads if not a.get("is_active")]

    # Kelime frekansı analizi
    all_text = " ".join(
        a.get("body", "") + " " + a.get("title", "") for a in ads
    ).lower()
    # Stopwords (TR + EN)
    stopwords = {
        "ve", "ile", "bir", "bu", "da", "de", "ki", "mi", "için", "en", "çok",
        "the", "a", "an", "and", "or", "is", "in", "on", "at", "to", "of",
        "be", "are", "was", "it", "that", "with", "your", "our",
    }
    words = [
        w.strip(".,!?;:'\"()[]") for w in all_text.split()
        if len(w) > 3 and w not in stopwords
    ]
    freq: dict[str, int] = {}
    for w in words:
        freq[w] = freq.get(w, 0) + 1
    top_keywords = sorted(freq.items(), key=lambda x: -x[1])[:15]

    body_lengths = [len(a.get("body", "")) for a in ads if a.get("body")]

    return {
        "page_id": page_id,
        "total_ads": len(ads),
        "active_ads": len(active),
        "inactive_ads": len(inactive),
        "avg_body_length": round(sum(body_lengths) / len(body_lengths)) if body_lengths else 0,
        "common_keywords": [{"word": w, "count": c} for w, c in top_keywords],
        "ads": ads,
    }
