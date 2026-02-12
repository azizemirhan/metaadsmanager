import logging
from fastapi import APIRouter, HTTPException, Query
from app.services.meta_service import meta_service
from app.services.ai_service import analyze_campaigns, analyze_single_campaign
from app.config import IS_PRODUCTION

logger = logging.getLogger(__name__)

router = APIRouter()


def _error_detail(e: Exception) -> str:
    logger.exception("AI analiz hatası: %s", e)
    return "Bir hata oluştu" if IS_PRODUCTION else str(e)


@router.get("/analyze")
async def analyze_all_campaigns(days: int = Query(30, ge=7, le=365)):
    """Tüm kampanyaları AI ile analiz et"""
    try:
        campaigns = await meta_service.get_campaigns(days)
        if not campaigns:
            raise HTTPException(status_code=404, detail="Kampanya bulunamadı")

        analysis = await analyze_campaigns(campaigns)
        return {
            "analysis": analysis,
            "campaign_count": len(campaigns),
            "period_days": days
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=_error_detail(e))


@router.get("/analyze/{campaign_id}")
async def analyze_campaign(campaign_id: str, days: int = Query(30, ge=7, le=365)):
    """Tek bir kampanyayı derinlemesine analiz et"""
    try:
        campaigns = await meta_service.get_campaigns(days)
        campaign = next((c for c in campaigns if c.get("id") == campaign_id), None)

        if not campaign:
            raise HTTPException(status_code=404, detail="Kampanya bulunamadı")

        analysis = await analyze_single_campaign(campaign)
        return {"campaign": campaign, "analysis": analysis}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=_error_detail(e))
