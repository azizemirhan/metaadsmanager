import logging
from fastapi import APIRouter, Query, HTTPException
from app.services.meta_service import meta_service
from app.config import IS_PRODUCTION

logger = logging.getLogger(__name__)

router = APIRouter()


def _error_detail(e: Exception) -> str:
    logger.exception("Campaigns hatası: %s", e)
    return "Bir hata oluştu" if IS_PRODUCTION else str(e)


@router.get("/")
async def get_campaigns(days: int = Query(30, ge=7, le=365)):
    """Tüm kampanyaları ve metriklerini getir"""
    try:
        campaigns = await meta_service.get_campaigns(days)
        return {"data": campaigns, "count": len(campaigns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=_error_detail(e))


@router.get("/summary")
async def get_account_summary(days: int = Query(30, ge=7, le=365)):
    """Hesap özeti"""
    try:
        summary = await meta_service.get_account_summary(days)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=_error_detail(e))


@router.get("/daily")
async def get_daily_breakdown(days: int = Query(30, ge=7, le=90)):
    """Günlük performans verisi"""
    try:
        data = await meta_service.get_daily_breakdown(days)
        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=_error_detail(e))


@router.get("/{campaign_id}/adsets")
async def get_ad_sets(campaign_id: str, days: int = Query(30, ge=7, le=365)):
    """Kampanyaya ait reklam setleri"""
    try:
        adsets = await meta_service.get_ad_sets(campaign_id, days)
        return {"data": adsets, "count": len(adsets)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=_error_detail(e))


@router.get("/{campaign_id}/ads")
async def get_ads(campaign_id: str, days: int = Query(30, ge=7, le=365)):
    """Kampanyaya ait reklamlar"""
    try:
        ads = await meta_service.get_ads(campaign_id, days)
        return {"data": ads, "count": len(ads)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=_error_detail(e))
