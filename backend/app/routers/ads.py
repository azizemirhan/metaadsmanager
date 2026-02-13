from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.meta_service import meta_service, MetaAPIError
from app import config

router = APIRouter()


def _handle_meta_error(e: Exception):
    if isinstance(e, MetaAPIError):
        raise HTTPException(status_code=503, detail=e.args[0] if e.args else "Meta API hatası.")
    raise HTTPException(status_code=503, detail=str(e))


class CreateAdBody(BaseModel):
    adset_id: str
    creative_id: str
    name: str
    status: str = "PAUSED"
    ad_account_id: Optional[str] = None


@router.post("")
async def create_ad(body: CreateAdBody):
    """Reklam oluşturur (adset + kreatif bağlanır)."""
    try:
        aid = body.ad_account_id or config.get_setting("META_AD_ACCOUNT_ID")
        if not aid:
            raise HTTPException(status_code=400, detail="ad_account_id veya META_AD_ACCOUNT_ID gerekli.")
        result = await meta_service.create_ad(
            aid,
            body.adset_id,
            body.creative_id,
            body.name,
            status=body.status,
        )
        return {"success": True, "ad": result}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except HTTPException:
        raise
    except Exception as e:
        _handle_meta_error(e)
