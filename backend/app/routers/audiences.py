# -*- coding: utf-8 -*-
"""
Audience Management API — Meta Custom Audience + Lookalike işlemleri.
Google Sheets export da bu router'dan sunulur.
"""
import csv
import io
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app import config
from app.database import get_session
from app.services.meta_service import meta_service, MetaAPIError, _get_token, _get_default_account_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/audiences", tags=["Audiences"])


# ─── Pydantic Şemaları ─────────────────────────────────────────────────────────

class CustomAudienceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    subtype: str = Field(
        default="CUSTOM",
        description="CUSTOM, WEBSITE, APP, OFFLINE_CONVERSION, LIST",
    )
    customer_file_source: Optional[str] = Field(
        default=None,
        description="USER_PROVIDED_ONLY, PARTNER_PROVIDED_ONLY, BOTH_USER_AND_PARTNER_PROVIDED (LIST için)",
    )
    ad_account_id: Optional[str] = None


class LookalikeCreate(BaseModel):
    name: str = Field(..., min_length=1)
    origin_audience_id: str = Field(..., description="Kaynak kitle ID'si")
    country: str = Field(default="TR", description="Hedef ülke kodu")
    ratio: float = Field(default=0.01, ge=0.01, le=0.20, description="0.01–0.20 (1%–20%)")
    ad_account_id: Optional[str] = None


# ─── Yardımcı: Meta API çağrısı ───────────────────────────────────────────────

async def _meta_get_audiences(account_id: str) -> list[dict]:
    """Hesabın custom audience listesini çeker."""
    import httpx
    token = _get_token()
    if not token:
        raise MetaAPIError("Token yapılandırılmamış.")
    params = {
        "access_token": token,
        "fields": "id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,description,delivery_status,data_source,retention_days",
        "limit": 200,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(
            f"https://graph.facebook.com/v21.0/{account_id}/customaudiences",
            params=params,
        )
        if not resp.is_success:
            body = {}
            try:
                body = resp.json()
            except Exception:
                pass
            err = (body.get("error") or {})
            raise MetaAPIError(err.get("message", f"HTTP {resp.status_code}"))
        return resp.json().get("data", [])


# ─── Endpoint'ler ──────────────────────────────────────────────────────────────

@router.get("")
async def list_audiences(
    ad_account_id: Optional[str] = Query(None),
):
    """Hesaptaki custom audience listesini getirir."""
    aid = ad_account_id or _get_default_account_id()
    if not aid:
        raise HTTPException(status_code=400, detail="ad_account_id veya META_AD_ACCOUNT_ID gerekli.")
    try:
        audiences = await _meta_get_audiences(aid)
        return {"data": audiences, "count": len(audiences)}
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/custom")
async def create_custom_audience(body: CustomAudienceCreate):
    """Yeni custom audience oluşturur."""
    import httpx
    aid = body.ad_account_id or _get_default_account_id()
    if not aid:
        raise HTTPException(status_code=400, detail="ad_account_id gerekli.")

    token = _get_token()
    if not token:
        raise HTTPException(status_code=503, detail="Meta API token yapılandırılmamış.")

    payload = {
        "name": body.name,
        "subtype": body.subtype,
        "access_token": token,
    }
    if body.description:
        payload["description"] = body.description
    if body.customer_file_source:
        payload["customer_file_source"] = body.customer_file_source

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            f"https://graph.facebook.com/v21.0/{aid}/customaudiences",
            data=payload,
        )
        if not resp.is_success:
            body_data = {}
            try:
                body_data = resp.json()
            except Exception:
                pass
            err = (body_data.get("error") or {})
            raise HTTPException(status_code=503, detail=err.get("message", f"HTTP {resp.status_code}"))
        result = resp.json()
        return {"success": True, "audience_id": result.get("id"), "data": result}


@router.post("/lookalike")
async def create_lookalike_audience(body: LookalikeCreate):
    """Kaynak kitleden lookalike audience oluşturur."""
    import httpx
    aid = body.ad_account_id or _get_default_account_id()
    if not aid:
        raise HTTPException(status_code=400, detail="ad_account_id gerekli.")

    token = _get_token()
    if not token:
        raise HTTPException(status_code=503, detail="Meta API token yapılandırılmamış.")

    payload = {
        "name": body.name,
        "subtype": "LOOKALIKE",
        "origin_audience_id": body.origin_audience_id,
        "lookalike_spec": json.dumps({
            "ratio": body.ratio,
            "country": body.country,
            "type": "similarity",
        }),
        "access_token": token,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            f"https://graph.facebook.com/v21.0/{aid}/customaudiences",
            data=payload,
        )
        if not resp.is_success:
            body_data = {}
            try:
                body_data = resp.json()
            except Exception:
                pass
            err = (body_data.get("error") or {})
            raise HTTPException(status_code=503, detail=err.get("message", f"HTTP {resp.status_code}"))
        result = resp.json()
        return {"success": True, "audience_id": result.get("id"), "data": result}


@router.delete("/{audience_id}")
async def delete_audience(
    audience_id: str,
    ad_account_id: Optional[str] = Query(None),
):
    """Custom audience siler."""
    import httpx
    token = _get_token()
    if not token:
        raise HTTPException(status_code=503, detail="Token yapılandırılmamış.")

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.delete(
            f"https://graph.facebook.com/v21.0/{audience_id}",
            params={"access_token": token},
        )
        if not resp.is_success:
            body = {}
            try:
                body = resp.json()
            except Exception:
                pass
            err = (body.get("error") or {})
            raise HTTPException(status_code=503, detail=err.get("message", f"HTTP {resp.status_code}"))
        return {"success": True, "message": "Kitle silindi."}


@router.get("/overlap")
async def audience_overlap(
    audience_ids: str = Query(..., description="Karşılaştırılacak kitle ID'leri, virgülle ayrılmış"),
    ad_account_id: Optional[str] = Query(None),
):
    """
    İki veya daha fazla custom audience arasındaki örtüşmeyi analiz eder.
    Meta API'nin reach estimate endpoint'ini kullanır.
    """
    import httpx
    aid = ad_account_id or _get_default_account_id()
    if not aid:
        raise HTTPException(status_code=400, detail="ad_account_id gerekli.")

    ids = [i.strip() for i in audience_ids.split(",") if i.strip()]
    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="En az 2 kitle ID'si gerekli.")

    token = _get_token()
    if not token:
        raise HTTPException(status_code=503, detail="Token yapılandırılmamış.")

    # Her kitle için ayrı tahmin al
    estimates = []
    async with httpx.AsyncClient(timeout=20.0) as client:
        for aud_id in ids:
            targeting_spec = json.dumps({
                "custom_audiences": [{"id": aud_id}]
            })
            resp = await client.get(
                f"https://graph.facebook.com/v21.0/{aid}/reachestimate",
                params={
                    "targeting_spec": targeting_spec,
                    "access_token": token,
                    "optimize_for": "REACH",
                },
            )
            if resp.is_success:
                data = resp.json()
                estimates.append({
                    "audience_id": aud_id,
                    "users_lower_bound": data.get("data", {}).get("users_lower_bound", 0),
                    "users_upper_bound": data.get("data", {}).get("users_upper_bound", 0),
                })
            else:
                estimates.append({
                    "audience_id": aud_id,
                    "users_lower_bound": 0,
                    "users_upper_bound": 0,
                    "error": f"HTTP {resp.status_code}",
                })

        # Birleşik (tüm kitleleri içeren) tahmin
        combined_spec = json.dumps({
            "custom_audiences": [{"id": i} for i in ids]
        })
        combined_resp = await client.get(
            f"https://graph.facebook.com/v21.0/{aid}/reachestimate",
            params={
                "targeting_spec": combined_spec,
                "access_token": token,
                "optimize_for": "REACH",
            },
        )
        combined_estimate = {}
        if combined_resp.is_success:
            combined_estimate = combined_resp.json().get("data", {})

    return {
        "individual_estimates": estimates,
        "combined_estimate": combined_estimate,
        "audience_ids": ids,
    }


# ─── Google Sheets Export ──────────────────────────────────────────────────────

@router.get("/export/csv")
async def export_audiences_csv(
    ad_account_id: Optional[str] = Query(None),
):
    """Audience listesini CSV olarak indirir (Google Sheets'e aktarılabilir)."""
    aid = ad_account_id or _get_default_account_id()
    if not aid:
        raise HTTPException(status_code=400, detail="ad_account_id gerekli.")
    try:
        audiences = await _meta_get_audiences(aid)
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e))

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "id", "name", "subtype",
            "approximate_count_lower_bound", "approximate_count_upper_bound",
            "description", "retention_days",
        ],
        extrasaction="ignore",
    )
    writer.writeheader()
    writer.writerows(audiences)

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audiences.csv"},
    )
