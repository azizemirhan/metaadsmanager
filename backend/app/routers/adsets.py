from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.meta_service import meta_service, MetaAPIError
from app import config

router = APIRouter()


def _handle_meta_error(e: Exception):
    if isinstance(e, MetaAPIError):
        raise HTTPException(status_code=503, detail=e.args[0] if e.args else "Meta API hatası.")
    raise HTTPException(status_code=503, detail=str(e))


class AdsetBudgetBody(BaseModel):
    daily_budget: Optional[float] = None
    lifetime_budget: Optional[float] = None


class CreateAdsetBody(BaseModel):
    campaign_id: str
    name: str
    daily_budget: Optional[int] = None
    lifetime_budget: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    targeting: Optional[Dict[str, Any]] = None
    billing_event: str = "LINK_CLICKS"
    optimization_goal: str = "LINK_CLICKS"
    status: str = "PAUSED"
    ad_account_id: Optional[str] = None


@router.post("")
async def create_adset(body: CreateAdsetBody):
    """Yeni reklam seti oluşturur. Bütçe hesap para biriminin en küçük biriminde (örn. TL kuruş)."""
    try:
        aid = body.ad_account_id or config.get_setting("META_AD_ACCOUNT_ID")
        if not aid:
            raise HTTPException(status_code=400, detail="ad_account_id veya META_AD_ACCOUNT_ID gerekli.")
        if body.daily_budget is None and body.lifetime_budget is None:
            raise HTTPException(status_code=400, detail="daily_budget veya lifetime_budget gerekli.")
        result = await meta_service.create_adset(
            aid,
            body.campaign_id,
            body.name,
            daily_budget=body.daily_budget,
            lifetime_budget=body.lifetime_budget,
            start_time=body.start_time,
            end_time=body.end_time,
            targeting=body.targeting,
            billing_event=body.billing_event,
            optimization_goal=body.optimization_goal,
            status=body.status,
        )
        return {"success": True, "adset": result}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except HTTPException:
        raise
    except Exception as e:
        _handle_meta_error(e)


@router.patch("/{adset_id}/budget")
async def update_adset_budget(adset_id: str, body: AdsetBudgetBody):
    """Reklam seti bütçesini günceller. Bütçe hesap para biriminin en küçük biriminde (örn. TL için kuruş, USD için cent)."""
    try:
        result = await meta_service.update_adset_budget(
            adset_id,
            daily_budget=body.daily_budget,
            lifetime_budget=body.lifetime_budget,
        )
        return {"success": True, "adset_id": adset_id, "result": result}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)
