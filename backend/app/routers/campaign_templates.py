# -*- coding: utf-8 -*-
"""Kampanya Klonlama ve Şablon Yönetimi."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import CurrentUser
from app.models import CampaignTemplate, campaign_template_to_dict
from app.services.meta_service import meta_service, MetaAPIError
from app import config

router = APIRouter(prefix="/api/campaign-templates", tags=["Campaign Templates"])


def _handle_meta_error(e: Exception):
    if isinstance(e, MetaAPIError):
        raise HTTPException(status_code=503, detail=str(e))
    raise HTTPException(status_code=503, detail=f"Meta API hatası: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# Şablon CRUD
# ══════════════════════════════════════════════════════════════════════════════

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    objective: str = "OUTCOME_TRAFFIC"
    status: str = "PAUSED"
    daily_budget: Optional[float] = None
    lifetime_budget: Optional[float] = None
    targeting: Optional[dict] = None
    ad_account_id: Optional[str] = None


@router.get("")
async def list_templates(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    ad_account_id: Optional[str] = Query(None),
):
    stmt = select(CampaignTemplate).order_by(desc(CampaignTemplate.created_at))
    if ad_account_id:
        stmt = stmt.where(CampaignTemplate.ad_account_id == ad_account_id)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return {"data": [campaign_template_to_dict(r) for r in rows], "count": len(rows)}


@router.post("")
async def create_template(
    body: TemplateCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Şablon adı boş olamaz.")

    template = CampaignTemplate(
        id=str(uuid.uuid4()),
        name=body.name.strip(),
        description=body.description,
        objective=body.objective,
        status=body.status,
        daily_budget=body.daily_budget,
        lifetime_budget=body.lifetime_budget,
        targeting=body.targeting,
        ad_account_id=body.ad_account_id,
        created_by=current_user.id,
    )
    session.add(template)
    await session.flush()
    return {"success": True, "data": campaign_template_to_dict(template)}


@router.get("/{template_id}")
async def get_template(
    template_id: str,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(CampaignTemplate).where(CampaignTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı.")
    return {"data": campaign_template_to_dict(template)}


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    body: TemplateCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(CampaignTemplate).where(CampaignTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı.")
    template.name = body.name.strip()
    template.description = body.description
    template.objective = body.objective
    template.status = body.status
    template.daily_budget = body.daily_budget
    template.lifetime_budget = body.lifetime_budget
    template.targeting = body.targeting
    template.ad_account_id = body.ad_account_id
    template.updated_at = datetime.now(timezone.utc)
    await session.flush()
    return {"success": True, "data": campaign_template_to_dict(template)}


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(CampaignTemplate).where(CampaignTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı.")
    await session.delete(template)
    await session.flush()
    return {"success": True, "message": "Şablon silindi."}


# ══════════════════════════════════════════════════════════════════════════════
# Şablondan Kampanya Oluştur
# ══════════════════════════════════════════════════════════════════════════════

class ApplyTemplateBody(BaseModel):
    name: str
    ad_account_id: Optional[str] = None
    status: Optional[str] = None  # None → şablondaki kullanılır


@router.post("/{template_id}/apply")
async def apply_template(
    template_id: str,
    body: ApplyTemplateBody,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Şablonu kullanarak Meta'da yeni kampanya oluşturur."""
    result = await session.execute(select(CampaignTemplate).where(CampaignTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı.")

    ad_account_id = body.ad_account_id or template.ad_account_id or config.get_setting("META_AD_ACCOUNT_ID")
    if not ad_account_id:
        raise HTTPException(status_code=400, detail="Reklam hesabı ID gerekli.")

    campaign_status = body.status or template.status or "PAUSED"
    if not campaign_status.startswith("PAUSED"):
        campaign_status = "PAUSED"  # Güvenli varsayılan

    try:
        payload: dict = {
            "name": body.name.strip() or template.name,
            "objective": template.objective,
            "status": campaign_status,
            "special_ad_categories": [],
        }
        if template.daily_budget:
            payload["daily_budget"] = str(int(template.daily_budget))
        if template.lifetime_budget:
            payload["lifetime_budget"] = str(int(template.lifetime_budget))

        result_data = await meta_service._post(
            f"/{ad_account_id}/campaigns", payload
        )
        campaign_id = result_data.get("id")
        return {
            "success": True,
            "campaign_id": campaign_id,
            "name": payload["name"],
            "template_id": template_id,
            "message": f"Kampanya '{payload['name']}' oluşturuldu.",
        }
    except Exception as e:
        _handle_meta_error(e)


# ══════════════════════════════════════════════════════════════════════════════
# Kampanya Klonlama
# ══════════════════════════════════════════════════════════════════════════════

class CloneBody(BaseModel):
    campaign_id: str
    new_name: Optional[str] = None
    status: str = "PAUSED"
    ad_account_id: Optional[str] = None
    save_as_template: bool = False
    template_name: Optional[str] = None


@router.post("/clone")
async def clone_campaign(
    body: CloneBody,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Mevcut kampanyayı klonlar; isteğe bağlı olarak şablon olarak kaydeder."""
    ad_account_id = body.ad_account_id or config.get_setting("META_AD_ACCOUNT_ID")
    if not ad_account_id:
        raise HTTPException(status_code=400, detail="Reklam hesabı ID gerekli.")

    try:
        # Mevcut kampanyanın bilgilerini al
        campaign_data = await meta_service._get(
            f"/{body.campaign_id}",
            params={"fields": "name,objective,status,daily_budget,lifetime_budget,special_ad_categories"},
        )
        original_name: str = campaign_data.get("name", "Kampanya")
        new_name = body.new_name or f"{original_name} (Kopya)"

        payload = {
            "name": new_name,
            "objective": campaign_data.get("objective", "OUTCOME_TRAFFIC"),
            "status": body.status,
            "special_ad_categories": campaign_data.get("special_ad_categories", []),
        }
        if campaign_data.get("daily_budget"):
            payload["daily_budget"] = campaign_data["daily_budget"]
        if campaign_data.get("lifetime_budget"):
            payload["lifetime_budget"] = campaign_data["lifetime_budget"]

        result_data = await meta_service._post(f"/{ad_account_id}/campaigns", payload)
        new_campaign_id = result_data.get("id")

        # İsteğe bağlı şablon kaydet
        saved_template = None
        if body.save_as_template:
            template = CampaignTemplate(
                id=str(uuid.uuid4()),
                name=body.template_name or new_name,
                description=f"'{original_name}' kampanyasından klonlandı.",
                objective=payload["objective"],
                status="PAUSED",
                daily_budget=float(campaign_data["daily_budget"]) if campaign_data.get("daily_budget") else None,
                lifetime_budget=float(campaign_data["lifetime_budget"]) if campaign_data.get("lifetime_budget") else None,
                ad_account_id=ad_account_id,
                source_campaign_id=body.campaign_id,
                created_by=current_user.id,
            )
            session.add(template)
            await session.flush()
            saved_template = campaign_template_to_dict(template)

        return {
            "success": True,
            "original_campaign_id": body.campaign_id,
            "new_campaign_id": new_campaign_id,
            "new_name": new_name,
            "saved_template": saved_template,
        }
    except Exception as e:
        _handle_meta_error(e)


@router.post("/save-from-campaign")
async def save_template_from_campaign(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    campaign_id: str = Query(...),
    template_name: Optional[str] = Query(None),
    ad_account_id: Optional[str] = Query(None),
):
    """Var olan kampanyayı şablon olarak kaydeder (Meta API çağrısı yapar)."""
    account_id = ad_account_id or config.get_setting("META_AD_ACCOUNT_ID")

    try:
        campaign_data = await meta_service._get(
            f"/{campaign_id}",
            params={"fields": "name,objective,status,daily_budget,lifetime_budget"},
        )
        original_name = campaign_data.get("name", "Kampanya")

        template = CampaignTemplate(
            id=str(uuid.uuid4()),
            name=template_name or f"{original_name} Şablonu",
            description=f"'{original_name}' (ID: {campaign_id}) kampanyasından kaydedildi.",
            objective=campaign_data.get("objective", "OUTCOME_TRAFFIC"),
            status="PAUSED",
            daily_budget=float(campaign_data["daily_budget"]) if campaign_data.get("daily_budget") else None,
            lifetime_budget=float(campaign_data["lifetime_budget"]) if campaign_data.get("lifetime_budget") else None,
            ad_account_id=account_id,
            source_campaign_id=campaign_id,
            created_by=current_user.id,
        )
        session.add(template)
        await session.flush()
        return {"success": True, "data": campaign_template_to_dict(template)}
    except Exception as e:
        _handle_meta_error(e)
