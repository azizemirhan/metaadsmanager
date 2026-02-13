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


class UploadImageBody(BaseModel):
    image_url: str
    ad_account_id: Optional[str] = None


class UploadVideoBody(BaseModel):
    video_url: str
    title: Optional[str] = None
    ad_account_id: Optional[str] = None


class CreateCreativeBody(BaseModel):
    name: str
    image_hash: Optional[str] = None
    video_id: Optional[str] = None
    link: str = "https://www.facebook.com"
    message: str = ""
    headline: str = ""
    call_to_action: str = "LEARN_MORE"
    ad_account_id: Optional[str] = None


@router.post("/upload-image")
async def upload_image(body: UploadImageBody):
    """Görsel URL'sini Meta'ya yükler; dönen hash kreatif oluşturmada kullanılır."""
    try:
        aid = body.ad_account_id or config.get_setting("META_AD_ACCOUNT_ID")
        if not aid:
            raise HTTPException(status_code=400, detail="ad_account_id veya META_AD_ACCOUNT_ID gerekli.")
        result = await meta_service.upload_ad_image(aid, body.image_url)
        return {"success": True, **result}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except HTTPException:
        raise
    except Exception as e:
        _handle_meta_error(e)


@router.post("/upload-video")
async def upload_video(body: UploadVideoBody):
    """Video URL'sini Meta'ya yükler; dönen video_id kreatif oluşturmada kullanılır."""
    try:
        aid = body.ad_account_id or config.get_setting("META_AD_ACCOUNT_ID")
        if not aid:
            raise HTTPException(status_code=400, detail="ad_account_id veya META_AD_ACCOUNT_ID gerekli.")
        result = await meta_service.upload_ad_video(aid, body.video_url, title=body.title)
        return {"success": True, **result}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except HTTPException:
        raise
    except Exception as e:
        _handle_meta_error(e)


@router.post("")
async def create_creative(body: CreateCreativeBody):
    """Kreatif oluşturur (image_hash veya video_id + link, metin, CTA)."""
    try:
        aid = body.ad_account_id or config.get_setting("META_AD_ACCOUNT_ID")
        if not aid:
            raise HTTPException(status_code=400, detail="ad_account_id veya META_AD_ACCOUNT_ID gerekli.")
        if not body.image_hash and not body.video_id:
            raise HTTPException(status_code=400, detail="image_hash veya video_id gerekli.")
        result = await meta_service.create_ad_creative(
            aid,
            body.name,
            image_hash=body.image_hash,
            video_id=body.video_id,
            link=body.link,
            message=body.message,
            headline=body.headline,
            call_to_action=body.call_to_action,
        )
        return {"success": True, "creative": result}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except HTTPException:
        raise
    except Exception as e:
        _handle_meta_error(e)
