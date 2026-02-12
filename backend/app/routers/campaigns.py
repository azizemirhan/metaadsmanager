from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
import io
from app.services.meta_service import meta_service, MetaAPIError

router = APIRouter()


def _handle_meta_error(e: Exception):
    """Meta API hatalarını 503 ve anlaşılır mesajla döndürür."""
    if isinstance(e, MetaAPIError):
        raise HTTPException(status_code=503, detail=e.args[0] if e.args else "Meta API hatası.")
    raise HTTPException(status_code=503, detail=f"Meta API bağlantı hatası. Lütfen .env dosyasında META_ACCESS_TOKEN ve META_AD_ACCOUNT_ID değerlerini kontrol edin. Detay: {str(e)}")


@router.get("")
@router.get("/")
async def get_campaigns(days: int = Query(30, ge=7, le=365)):
    """Tüm kampanyaları ve metriklerini getir"""
    try:
        campaigns = await meta_service.get_campaigns(days)
        return {"data": campaigns, "count": len(campaigns)}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/summary")
async def get_account_summary(days: int = Query(30, ge=7, le=365)):
    """Hesap özeti"""
    try:
        summary = await meta_service.get_account_summary(days)
        return summary
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/daily")
async def get_daily_breakdown(days: int = Query(30, ge=7, le=90)):
    """Günlük performans verisi"""
    try:
        data = await meta_service.get_daily_breakdown(days)
        return {"data": data}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/{campaign_id}/adsets")
async def get_ad_sets(campaign_id: str, days: int = Query(30, ge=7, le=365)):
    """Kampanyaya ait reklam setleri"""
    try:
        adsets = await meta_service.get_ad_sets(campaign_id, days)
        return {"data": adsets, "count": len(adsets)}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/{campaign_id}/ads")
async def get_ads(campaign_id: str, days: int = Query(30, ge=7, le=365)):
    """Kampanyaya ait reklamlar"""
    try:
        ads = await meta_service.get_ads(campaign_id, days)
        return {"data": ads, "count": len(ads)}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)
