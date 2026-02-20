# -*- coding: utf-8 -*-
"""
Campaign Otomasyon API — CRUD + manuel tetikleme endpoint'leri.
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import (
    CampaignAutomationRule,
    CampaignAutomationLog,
    automation_rule_to_dict,
    automation_log_to_dict,
)
from app.services.automation_service import (
    VALID_ACTIONS,
    VALID_METRICS,
    VALID_CONDITIONS,
    run_automation_rule,
    run_all_active_rules,
)

router = APIRouter(prefix="/api/automation", tags=["Automation"])

METRICS_PATTERN = "^(ctr|roas|spend|cpc|cpm|impressions|clicks|frequency)$"
CONDITIONS_PATTERN = "^(lt|gt)$"
ACTIONS_PATTERN = "^(pause|resume|notify|budget_decrease|budget_increase)$"


# ─── Pydantic Şemaları ─────────────────────────────────────────────────────────

class AutomationRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    metric: str = Field(..., pattern=METRICS_PATTERN)
    condition: str = Field(..., pattern=CONDITIONS_PATTERN)
    threshold: float = Field(..., gt=0)
    action: str = Field(..., pattern=ACTIONS_PATTERN)
    action_value: Optional[float] = Field(
        None, gt=0, le=100,
        description="Bütçe değişim yüzdesi (budget_decrease/increase için, örn. 20 = %20)"
    )
    ad_account_id: Optional[str] = None
    campaign_ids: Optional[List[str]] = Field(default=None, description="Boşsa tüm kampanyalar")
    notify_email: Optional[str] = None
    notify_whatsapp: Optional[str] = None
    cooldown_minutes: int = Field(default=60, ge=5, le=1440)


class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    metric: Optional[str] = Field(None, pattern=METRICS_PATTERN)
    condition: Optional[str] = Field(None, pattern=CONDITIONS_PATTERN)
    threshold: Optional[float] = Field(None, gt=0)
    action: Optional[str] = Field(None, pattern=ACTIONS_PATTERN)
    action_value: Optional[float] = Field(None, gt=0, le=100)
    ad_account_id: Optional[str] = None
    campaign_ids: Optional[List[str]] = None
    notify_email: Optional[str] = None
    notify_whatsapp: Optional[str] = None
    is_active: Optional[bool] = None
    cooldown_minutes: Optional[int] = Field(None, ge=5, le=1440)


# ─── CRUD Endpoint'leri ─────────────────────────────────────────────────────────

@router.get("/rules")
async def list_rules(
    session: AsyncSession = Depends(get_session),
    ad_account_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Tüm otomasyon kurallarını listele."""
    stmt = select(CampaignAutomationRule)
    if ad_account_id:
        stmt = stmt.where(CampaignAutomationRule.ad_account_id == ad_account_id)
    if is_active is not None:
        stmt = stmt.where(CampaignAutomationRule.is_active == is_active)
    stmt = stmt.order_by(desc(CampaignAutomationRule.created_at)).offset(offset).limit(limit)

    result = await session.execute(stmt)
    rows = result.scalars().all()
    return {"data": [automation_rule_to_dict(r) for r in rows], "count": len(rows)}


@router.post("/rules")
async def create_rule(
    body: AutomationRuleCreate,
    session: AsyncSession = Depends(get_session),
):
    """Yeni otomasyon kuralı oluştur."""
    if body.action in ("budget_decrease", "budget_increase") and not body.action_value:
        raise HTTPException(
            status_code=422,
            detail="budget_decrease/budget_increase aksiyonu için action_value (yüzde) zorunludur.",
        )

    rule = CampaignAutomationRule(
        id=str(uuid4()),
        name=body.name,
        description=body.description,
        metric=body.metric,
        condition=body.condition,
        threshold=body.threshold,
        action=body.action,
        action_value=body.action_value,
        ad_account_id=body.ad_account_id,
        campaign_ids=body.campaign_ids,
        notify_email=body.notify_email,
        notify_whatsapp=body.notify_whatsapp,
        cooldown_minutes=body.cooldown_minutes,
        is_active=True,
    )
    session.add(rule)
    await session.commit()
    return {"success": True, "data": automation_rule_to_dict(rule)}


@router.get("/rules/{rule_id}")
async def get_rule(rule_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(CampaignAutomationRule).where(CampaignAutomationRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    return {"data": automation_rule_to_dict(rule)}


@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: str,
    body: AutomationRuleUpdate,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(CampaignAutomationRule).where(CampaignAutomationRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    rule.updated_at = datetime.now(timezone.utc)

    await session.commit()
    return {"success": True, "data": automation_rule_to_dict(rule)}


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(CampaignAutomationRule).where(CampaignAutomationRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    await session.delete(rule)
    await session.commit()
    return {"success": True, "message": "Kural silindi."}


@router.post("/rules/{rule_id}/toggle")
async def toggle_rule(rule_id: str, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(CampaignAutomationRule).where(CampaignAutomationRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    rule.is_active = not rule.is_active
    rule.updated_at = datetime.now(timezone.utc)
    await session.commit()
    return {
        "success": True,
        "is_active": rule.is_active,
        "message": f"Kural {'aktif' if rule.is_active else 'pasif'} yapıldı.",
    }


# ─── Tetikleme Endpoint'leri ──────────────────────────────────────────────────

@router.post("/rules/{rule_id}/run")
async def run_rule_now(
    rule_id: str,
    session: AsyncSession = Depends(get_session),
    dry_run: bool = Query(False, description="True ise Meta'ya yazma yapmaz, sadece önizler"),
):
    """Belirli bir kuralı hemen çalıştır (cooldown'u atlar)."""
    result = await session.execute(
        select(CampaignAutomationRule).where(CampaignAutomationRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")

    # Manuel çalıştırmada cooldown'u sıfırla
    rule.last_triggered = None

    triggered = await run_automation_rule(rule, session, dry_run=dry_run)
    return {
        "rule": automation_rule_to_dict(rule),
        "dry_run": dry_run,
        "triggered_count": len(triggered),
        "results": triggered,
    }


@router.post("/run-all")
async def run_all_rules(
    session: AsyncSession = Depends(get_session),
    ad_account_id: Optional[str] = Query(None),
    dry_run: bool = Query(False),
):
    """Tüm aktif otomasyon kurallarını çalıştır."""
    summary = await run_all_active_rules(session, ad_account_id=ad_account_id, dry_run=dry_run)
    return summary


# ─── Log Endpoint'leri ─────────────────────────────────────────────────────────

@router.get("/logs")
async def list_logs(
    session: AsyncSession = Depends(get_session),
    rule_id: Optional[str] = Query(None),
    campaign_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Otomasyon çalıştırma geçmişi."""
    stmt = select(CampaignAutomationLog)
    if rule_id:
        stmt = stmt.where(CampaignAutomationLog.rule_id == rule_id)
    if campaign_id:
        stmt = stmt.where(CampaignAutomationLog.campaign_id == campaign_id)
    stmt = stmt.order_by(desc(CampaignAutomationLog.executed_at)).offset(offset).limit(limit)

    result = await session.execute(stmt)
    rows = result.scalars().all()
    return {"data": [automation_log_to_dict(r) for r in rows], "count": len(rows)}


# ─── Bilgi Endpoint'i ──────────────────────────────────────────────────────────

@router.get("/meta")
async def get_automation_meta():
    """Desteklenen metrik, koşul ve aksiyon listesi."""
    return {
        "metrics": [
            {"id": "ctr", "name": "CTR (Tıklama Oranı)", "unit": "%"},
            {"id": "roas", "name": "ROAS (Yatırım Getirisi)", "unit": "x"},
            {"id": "spend", "name": "Harcama", "unit": "₺"},
            {"id": "cpc", "name": "CPC (Tıklama Başına Maliyet)", "unit": "₺"},
            {"id": "cpm", "name": "CPM (Bin Gösterim Maliyeti)", "unit": "₺"},
            {"id": "impressions", "name": "Gösterim", "unit": "adet"},
            {"id": "clicks", "name": "Tıklama", "unit": "adet"},
            {"id": "frequency", "name": "Frequency (Tekrar Gösterim)", "unit": "x"},
        ],
        "conditions": [
            {"id": "lt", "name": "Küçükse (<)", "description": "Değer eşikten küçük olduğunda"},
            {"id": "gt", "name": "Büyükse (>)", "description": "Değer eşikten büyük olduğunda"},
        ],
        "actions": [
            {"id": "pause", "name": "Kampanyayı Duraklat", "description": "Kampanyayı PAUSED yapar"},
            {"id": "resume", "name": "Kampanyayı Başlat", "description": "Kampanyayı ACTIVE yapar"},
            {"id": "budget_decrease", "name": "Bütçeyi Azalt (%)", "description": "Günlük bütçeyi belirtilen yüzde kadar düşürür", "requires_value": True},
            {"id": "budget_increase", "name": "Bütçeyi Artır (%)", "description": "Günlük bütçeyi belirtilen yüzde kadar artırır", "requires_value": True},
            {"id": "notify", "name": "Bildirim Gönder", "description": "Email/WhatsApp ile uyarı gönderir"},
        ],
        "examples": [
            {
                "name": "Düşük CTR → Duraklat",
                "metric": "ctr", "condition": "lt", "threshold": 0.5,
                "action": "pause",
                "description": "CTR %0.5 altına düşünce kampanyayı duraklat",
            },
            {
                "name": "Düşük ROAS → Bütçe Azalt",
                "metric": "roas", "condition": "lt", "threshold": 1.5,
                "action": "budget_decrease", "action_value": 20,
                "description": "ROAS 1.5x altına düşünce bütçeyi %20 azalt",
            },
            {
                "name": "Yüksek Frequency → Uyar",
                "metric": "frequency", "condition": "gt", "threshold": 4.0,
                "action": "notify",
                "description": "Frequency 4'ü aşınca bildirim gönder",
            },
            {
                "name": "Yüksek ROAS → Bütçe Artır",
                "metric": "roas", "condition": "gt", "threshold": 4.0,
                "action": "budget_increase", "action_value": 15,
                "description": "ROAS 4x üzerindeyken bütçeyi %15 artır",
            },
        ],
    }
