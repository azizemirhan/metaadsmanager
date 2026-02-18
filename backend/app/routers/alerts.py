# -*- coding: utf-8 -*-
"""Akıllı Uyarı Sistemi API - CRUD + Test Endpoint'leri."""
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import AlertRule, AlertHistory, alert_rule_to_dict, alert_history_to_dict
from app.services.meta_service import meta_service, MetaAPIError
from app import config

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


# ============ Pydantic Modeller ============

class AlertRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Kural adı")
    metric: str = Field(..., pattern="^(ctr|roas|spend|cpc|cpm|impressions|clicks|frequency)$")
    condition: str = Field(..., pattern="^(lt|gt|change_pct)$", description="lt: küçükse, gt: büyükse, change_pct: değişim %")
    threshold: float = Field(..., gt=0, description="Eşik değeri")
    ad_account_id: Optional[str] = Field(None, description="Belirli hesap için (boşsa tümü)")
    channels: List[str] = Field(default=["email"], description="Bildirim kanalları: email, whatsapp")
    email_to: Optional[str] = Field(None, description="E-posta adresi")
    whatsapp_to: Optional[str] = Field(None, description="WhatsApp numarası")
    cooldown_minutes: int = Field(default=60, ge=5, le=1440, description="Aynı uyarı için bekleme süresi (dakika)")


class AlertRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    metric: Optional[str] = Field(None, pattern="^(ctr|roas|spend|cpc|cpm|impressions|clicks|frequency)$")
    condition: Optional[str] = Field(None, pattern="^(lt|gt|change_pct)$")
    threshold: Optional[float] = Field(None, gt=0)
    ad_account_id: Optional[str] = None
    channels: Optional[List[str]] = None
    email_to: Optional[str] = None
    whatsapp_to: Optional[str] = None
    is_active: Optional[bool] = None
    cooldown_minutes: Optional[int] = Field(None, ge=5, le=1440)


class AlertTestResult(BaseModel):
    rule_id: str
    rule_name: str
    triggered: bool
    metric: str
    threshold: float
    actual_value: float
    message: Optional[str] = None
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None


# ============ CRUD Endpoint'leri ============

@router.get("/rules")
async def list_alert_rules(
    session: AsyncSession = Depends(get_session),
    ad_account_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Tüm uyarı kurallarını listele."""
    stmt = select(AlertRule)
    
    if ad_account_id:
        stmt = stmt.where(AlertRule.ad_account_id == ad_account_id)
    if is_active is not None:
        stmt = stmt.where(AlertRule.is_active == is_active)
    
    stmt = stmt.order_by(desc(AlertRule.created_at)).offset(offset).limit(limit)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    
    return {
        "data": [alert_rule_to_dict(r) for r in rows],
        "count": len(rows),
        "limit": limit,
        "offset": offset,
    }


@router.post("/rules")
async def create_alert_rule(
    body: AlertRuleCreate,
    session: AsyncSession = Depends(get_session),
):
    """Yeni uyarı kuralı oluştur."""
    rule = AlertRule(
        id=str(uuid4()),
        name=body.name,
        metric=body.metric,
        condition=body.condition,
        threshold=body.threshold,
        ad_account_id=body.ad_account_id,
        channels=body.channels,
        email_to=body.email_to,
        whatsapp_to=body.whatsapp_to,
        cooldown_minutes=body.cooldown_minutes,
        is_active=True,
    )
    session.add(rule)
    await session.commit()
    
    return {
        "success": True,
        "data": alert_rule_to_dict(rule),
        "message": "Uyarı kuralı oluşturuldu.",
    }


@router.get("/rules/{rule_id}")
async def get_alert_rule(
    rule_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Tekil uyarı kuralı detayı."""
    result = await session.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    
    return {"data": alert_rule_to_dict(rule)}


@router.put("/rules/{rule_id}")
async def update_alert_rule(
    rule_id: str,
    body: AlertRuleUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Uyarı kuralını güncelle."""
    result = await session.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)
    
    await session.commit()
    return {"success": True, "data": alert_rule_to_dict(rule), "message": "Kural güncellendi."}


@router.delete("/rules/{rule_id}")
async def delete_alert_rule(
    rule_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Uyarı kuralını sil."""
    result = await session.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    
    await session.delete(rule)
    await session.commit()
    return {"success": True, "message": "Kural silindi."}


@router.post("/rules/{rule_id}/toggle")
async def toggle_alert_rule(
    rule_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Kuralı aktif/pasif yap."""
    result = await session.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    
    rule.is_active = not rule.is_active
    await session.commit()
    
    return {
        "success": True,
        "is_active": rule.is_active,
        "message": f"Kural {'aktif' if rule.is_active else 'pasif'} yapıldı.",
    }


# ============ History Endpoint'leri ============

@router.get("/history")
async def list_alert_history(
    session: AsyncSession = Depends(get_session),
    rule_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Tetiklenmiş uyarı geçmişi."""
    stmt = select(AlertHistory)
    
    if rule_id:
        stmt = stmt.where(AlertHistory.rule_id == rule_id)
    
    stmt = stmt.order_by(desc(AlertHistory.sent_at)).offset(offset).limit(limit)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    
    return {
        "data": [alert_history_to_dict(r) for r in rows],
        "count": len(rows),
    }


# ============ Test / Manuel Kontrol Endpoint'leri ============

@router.post("/test/{rule_id}")
async def test_alert_rule(
    rule_id: str,
    session: AsyncSession = Depends(get_session),
    days: int = Query(7, ge=1, le=90),
):
    """
    Belirli bir kuralı hemen test et (manuel kontrol).
    Gerçekten bildirim göndermez, sadece sonucu döner.
    """
    result = await session.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    
    if not rule:
        raise HTTPException(status_code=404, detail="Kural bulunamadı.")
    
    try:
        campaigns = await meta_service.get_campaigns(days, account_id=rule.ad_account_id)
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=f"Meta API hatası: {e}")
    
    test_results = []
    
    for campaign in campaigns:
        metric_value = campaign.get(rule.metric)
        if metric_value is None:
            continue
        
        metric_value = float(metric_value)
        triggered = False
        
        if rule.condition == "lt" and metric_value < rule.threshold:
            triggered = True
        elif rule.condition == "gt" and metric_value > rule.threshold:
            triggered = True
        
        if triggered:
            test_results.append(AlertTestResult(
                rule_id=rule.id,
                rule_name=rule.name,
                triggered=True,
                metric=rule.metric,
                threshold=rule.threshold,
                actual_value=metric_value,
                message=f"{campaign.get('name', 'Kampanya')} - {rule.metric.upper()}: {metric_value:.2f} (eşik: {rule.threshold})",
                campaign_id=campaign.get('id'),
                campaign_name=campaign.get('name'),
            ))
    
    return {
        "rule": alert_rule_to_dict(rule),
        "campaigns_checked": len(campaigns),
        "alerts_found": len(test_results),
        "results": test_results,
    }


@router.post("/check-all")
async def check_all_rules_manually(
    session: AsyncSession = Depends(get_session),
    ad_account_id: Optional[str] = Query(None),
):
    """
    Tüm aktif kuralları hemen kontrol et (manuel tetikleme).
    Bu endpoint arka plan job'ı yerine senkron çalışır, hızlı test için.
    """
    stmt = select(AlertRule).where(AlertRule.is_active == True)
    if ad_account_id:
        stmt = stmt.where(AlertRule.ad_account_id == ad_account_id)
    
    result = await session.execute(stmt)
    rules = result.scalars().all()
    
    if not rules:
        return {"message": "Aktif kural bulunamadı.", "checked": 0, "triggered": 0}
    
    # Tüm kampanyaları bir kere çek (optimizasyon)
    try:
        campaigns = await meta_service.get_campaigns(7, account_id=ad_account_id)
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=f"Meta API hatası: {e}")
    
    triggered_count = 0
    
    for rule in rules:
        # Cooldown kontrolü
        if rule.last_triggered and rule.cooldown_minutes:
            cooldown_end = rule.last_triggered + timedelta(minutes=rule.cooldown_minutes)
            if datetime.utcnow() < cooldown_end:
                continue
        
        for campaign in campaigns:
            metric_value = campaign.get(rule.metric)
            if metric_value is None:
                continue
            
            metric_value = float(metric_value)
            
            if rule.condition == "lt" and metric_value < rule.threshold:
                triggered_count += 1
                # Not: Gerçek uygulamada burada bildirim gönderilir
                break  # Bir kural bir kez tetiklenir
            elif rule.condition == "gt" and metric_value > rule.threshold:
                triggered_count += 1
                break
    
    return {
        "message": f"{len(rules)} kural kontrol edildi.",
        "checked": len(rules),
        "triggered": triggered_count,
        "campaigns_checked": len(campaigns),
    }


# ============ Metrics Endpoint ============

@router.get("/metrics")
async def list_available_metrics():
    """Kullanılabilir metrik ve koşul listesi."""
    return {
        "metrics": [
            {"id": "ctr", "name": "CTR (Tıklama Oranı)", "format": "percent", "example": 1.5},
            {"id": "roas", "name": "ROAS (Yatırım Getirisi)", "format": "x", "example": 2.5},
            {"id": "spend", "name": "Harcama", "format": "currency", "example": 500},
            {"id": "cpc", "name": "CPC (Tıklama Başına Maliyet)", "format": "currency", "example": 2.5},
            {"id": "cpm", "name": "CPM (Bin Gösterim Başına Maliyet)", "format": "currency", "example": 15},
            {"id": "impressions", "name": "Gösterim", "format": "number", "example": 10000},
            {"id": "clicks", "name": "Tıklama", "format": "number", "example": 150},
            {"id": "frequency", "name": "Frequency (Tekrar Gösterim)", "format": "number", "example": 2.5},
        ],
        "conditions": [
            {"id": "lt", "name": "Küçükse (<)", "description": "Değer eşikten küçükse uyarı ver"},
            {"id": "gt", "name": "Büyükse (>)", "description": "Değer eşikten büyükse uyarı ver"},
        ],
        "channels": [
            {"id": "email", "name": "E-posta", "requires": "email_to"},
            {"id": "whatsapp", "name": "WhatsApp", "requires": "whatsapp_to"},
        ],
        "examples": [
            {
                "name": "Düşük CTR Uyarısı",
                "metric": "ctr",
                "condition": "lt",
                "threshold": 1.0,
                "description": "CTR %1'in altına düşerse uyarı ver"
            },
            {
                "name": "Yüksek Harcama Uyarısı",
                "metric": "spend",
                "condition": "gt",
                "threshold": 1000,
                "description": "Harcama 1000 TL'yi aşınca uyarı ver"
            },
            {
                "name": "Düşük ROAS Uyarısı",
                "metric": "roas",
                "condition": "lt",
                "threshold": 2.0,
                "description": "ROAS 2x'in altına düşerse uyarı ver"
            },
            {
                "name": "Reklam Yorgunluğu",
                "metric": "frequency",
                "condition": "gt",
                "threshold": 3.0,
                "description": "Frequency 3'ü aşınca uyarı ver (yorgunluk riski)"
            },
        ]
    }
