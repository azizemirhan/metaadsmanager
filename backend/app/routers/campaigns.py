from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from app.services.meta_service import meta_service, MetaAPIError

router = APIRouter()


def _handle_meta_error(e: Exception):
    """Meta API hatalarini 503 ve anlasilir mesajla dondurur."""
    if isinstance(e, MetaAPIError):
        raise HTTPException(status_code=503, detail=e.args[0] if e.args else "Meta API hatasi.")
    raise HTTPException(
        status_code=503,
        detail=f"Meta API baglanti hatasi. .env dosyasindaki META_ACCESS_TOKEN ve META_AD_ACCOUNT_ID degerlerini kontrol edin. Detay: {str(e)}"
    )


@router.get("/accounts")
async def get_ad_accounts():
    """Kullanicinin erisebilecegi reklam hesaplarini listele"""
    try:
        accounts = await meta_service.get_ad_accounts()
        return {"data": accounts, "count": len(accounts)}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("")
@router.get("/")
async def get_campaigns(
    days: int = Query(30, ge=7, le=365),
    ad_account_id: Optional[str] = Query(None, description="Opsiyonel reklam hesabi ID (act_XXX)")
):
    """Tum kampanyalari ve metriklerini getir"""
    try:
        campaigns = await meta_service.get_campaigns(days, ad_account_id=ad_account_id)
        return {"data": campaigns, "count": len(campaigns)}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/summary")
async def get_account_summary(
    days: int = Query(30, ge=7, le=365),
    ad_account_id: Optional[str] = Query(None)
):
    """Hesap ozeti"""
    try:
        summary = await meta_service.get_account_summary(days, ad_account_id=ad_account_id)
        return summary
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/daily")
async def get_daily_breakdown(
    days: int = Query(30, ge=7, le=90),
    ad_account_id: Optional[str] = Query(None)
):
    """Gunluk performans verisi"""
    try:
        data = await meta_service.get_daily_breakdown(days, ad_account_id=ad_account_id)
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
