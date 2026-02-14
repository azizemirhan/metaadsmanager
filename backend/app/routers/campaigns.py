from fastapi import APIRouter, Query, HTTPException, Body
from fastapi.responses import StreamingResponse
from typing import Optional
from pydantic import BaseModel
import io
from app.services.meta_service import meta_service, MetaAPIError
from app import config

router = APIRouter()


class CampaignStatusBody(BaseModel):
    status: str  # ACTIVE | PAUSED | ARCHIVED


class CreateCampaignBody(BaseModel):
    name: str
    objective: str = "OUTCOME_TRAFFIC"
    status: str = "PAUSED"
    ad_account_id: Optional[str] = None


def _handle_meta_error(e: Exception):
    """Meta API hatalarını 503 ve anlaşılır mesajla döndürür."""
    if isinstance(e, MetaAPIError):
        raise HTTPException(status_code=503, detail=e.args[0] if e.args else "Meta API hatası.")
    raise HTTPException(status_code=503, detail=f"Meta API bağlantı hatası. Ayarlar veya .env dosyasında META_ACCESS_TOKEN ve META_AD_ACCOUNT_ID değerlerini kontrol edin. Detay: {str(e)}")


@router.get("/pages")
async def get_pages():
    """Facebook sayfaları ve bağlı Instagram hesaplarını döner. Token'da pages_show_list, instagram_basic izinleri gerekir."""
    try:
        pages = await meta_service.get_pages_with_instagram()
        return {"data": pages}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/accounts")
async def get_accounts():
    """Kullanılabilir reklam hesapları listesi (META_AD_ACCOUNT_IDS ve META_AD_ACCOUNT_NAMES veya varsayılan tek hesap)."""
    ids_raw = config.get_setting("META_AD_ACCOUNT_IDS")
    names_raw = config.get_setting("META_AD_ACCOUNT_NAMES")
    if ids_raw:
        ids = [x.strip() for x in ids_raw.split(",") if x.strip()]
        names = [x.strip() for x in (names_raw or "").split(",") if x.strip()] if names_raw else []
        while len(names) < len(ids):
            names.append(ids[len(names)] if len(names) < len(ids) else "")
        accounts = [{"id": aid, "name": names[i] if i < len(names) else aid} for i, aid in enumerate(ids)]
    else:
        default = config.get_setting("META_AD_ACCOUNT_ID")
        if default:
            accounts = [{"id": default, "name": default}]
        else:
            accounts = []
    return {"data": accounts}


@router.get("")
@router.get("/")
async def get_campaigns(
    days: int = Query(30, ge=7, le=365),
    ad_account_id: Optional[str] = Query(None, description="Reklam hesabı ID (act_xxx)")
):
    """Tüm kampanyaları ve metriklerini getir"""
    try:
        campaigns = await meta_service.get_campaigns(days, account_id=ad_account_id)
        return {"data": campaigns, "count": len(campaigns)}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/summary")
async def get_account_summary(
    days: int = Query(30, ge=7, le=365),
    ad_account_id: Optional[str] = Query(None, description="Reklam hesabı ID")
):
    """Hesap özeti"""
    try:
        summary = await meta_service.get_account_summary(days, account_id=ad_account_id)
        return summary
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/daily")
async def get_daily_breakdown(
    days: int = Query(30, ge=7, le=90),
    ad_account_id: Optional[str] = Query(None, description="Reklam hesabı ID")
):
    """Günlük performans verisi"""
    try:
        data = await meta_service.get_daily_breakdown(days, account_id=ad_account_id)
        return {"data": data}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.post("")
async def create_campaign(body: CreateCampaignBody):
    """Yeni kampanya oluşturur."""
    try:
        aid = body.ad_account_id or config.get_setting("META_AD_ACCOUNT_ID")
        if not aid:
            raise HTTPException(status_code=400, detail="ad_account_id veya META_AD_ACCOUNT_ID gerekli.")
        result = await meta_service.create_campaign(
            aid, body.name, body.objective, body.status
        )
        return {"success": True, "campaign": result}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.patch("/{campaign_id}/status")
async def update_campaign_status(campaign_id: str, body: CampaignStatusBody):
    """Kampanya durumunu günceller (ACTIVE, PAUSED, ARCHIVED)."""
    try:
        result = await meta_service.update_campaign_status(campaign_id, body.status)
        return {"success": True, "campaign_id": campaign_id, "status": body.status.upper(), "result": result}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/{campaign_id}/adsets")
async def get_ad_sets(
    campaign_id: str,
    days: int = Query(30, ge=7, le=365),
    ad_account_id: Optional[str] = Query(None)
):
    """Kampanyaya ait reklam setleri"""
    try:
        adsets = await meta_service.get_ad_sets(campaign_id, days, account_id=ad_account_id)
        return {"data": adsets, "count": len(adsets)}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/{campaign_id}/ads")
async def get_ads(
    campaign_id: str,
    days: int = Query(30, ge=7, le=365),
    ad_account_id: Optional[str] = Query(None)
):
    """Kampanyaya ait reklamlar"""
    try:
        ads = await meta_service.get_ads(campaign_id, days, account_id=ad_account_id)
        return {"data": ads, "count": len(ads)}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)
