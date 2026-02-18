# -*- coding: utf-8 -*-
"""
Zamanlanmış Otomatik Raporlar API

Kullanıcıların periyodik (günlük, haftalık, aylık) rapor almasını sağlar.
Celery beat tarafından her dakika kontrol edilir.
"""
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import ScheduledReport, ScheduledReportLog, scheduled_report_to_dict, scheduled_report_log_to_dict
from app import config

router = APIRouter(prefix="/api/scheduled-reports", tags=["Scheduled Reports"])


# ============ Pydantic Modeller ============

class ScheduledReportCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    report_type: str = Field(..., pattern="^(weekly_summary|campaign_list|performance|daily_summary)$")
    days: int = Field(default=7, ge=1, le=90)
    ad_account_id: Optional[str] = Field(None)
    
    # Zamanlama
    frequency: str = Field(..., pattern="^(daily|weekly|monthly)$")
    day_of_week: Optional[int] = Field(None, ge=0, le=6)  # 0=Pazar
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    hour: int = Field(default=9, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    timezone: str = Field(default="Europe/Istanbul")
    
    # Bildirim
    channels: List[str] = Field(default=["email"])
    email_to: Optional[str] = Field(None)
    whatsapp_to: Optional[str] = Field(None)


class ScheduledReportUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    report_type: Optional[str] = Field(None, pattern="^(weekly_summary|campaign_list|performance|daily_summary)$")
    days: Optional[int] = Field(None, ge=1, le=90)
    ad_account_id: Optional[str] = None
    frequency: Optional[str] = Field(None, pattern="^(daily|weekly|monthly)$")
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    hour: Optional[int] = Field(None, ge=0, le=23)
    minute: Optional[int] = Field(None, ge=0, le=59)
    channels: Optional[List[str]] = None
    email_to: Optional[str] = None
    whatsapp_to: Optional[str] = None
    is_active: Optional[bool] = None


# ============ CRUD Endpoint'leri ============

@router.get("")
async def list_scheduled_reports(
    session: AsyncSession = Depends(get_session),
    ad_account_id: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Tüm zamanlanmış raporları listele."""
    stmt = select(ScheduledReport)
    
    if ad_account_id:
        stmt = stmt.where(ScheduledReport.ad_account_id == ad_account_id)
    if is_active is not None:
        stmt = stmt.where(ScheduledReport.is_active == is_active)
    
    stmt = stmt.order_by(desc(ScheduledReport.created_at)).limit(limit)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    
    return {
        "data": [scheduled_report_to_dict(r) for r in rows],
        "count": len(rows),
    }


@router.post("")
async def create_scheduled_report(
    body: ScheduledReportCreate,
    session: AsyncSession = Depends(get_session),
):
    """Yeni zamanlanmış rapor oluştur."""
    # Validation
    if body.frequency == "weekly" and body.day_of_week is None:
        raise HTTPException(status_code=400, detail="Haftalık rapor için gün seçilmeli (0-6)")
    if body.frequency == "monthly" and body.day_of_month is None:
        raise HTTPException(status_code=400, detail="Aylık rapor için ayın günü seçilmeli (1-31)")
    
    # next_run_at hesapla
    next_run = calculate_next_run(
        frequency=body.frequency,
        day_of_week=body.day_of_week,
        day_of_month=body.day_of_month,
        hour=body.hour,
        minute=body.minute,
    )
    
    report = ScheduledReport(
        id=str(uuid4()),
        name=body.name,
        report_type=body.report_type,
        days=body.days,
        ad_account_id=body.ad_account_id,
        frequency=body.frequency,
        day_of_week=body.day_of_week,
        day_of_month=body.day_of_month,
        hour=body.hour,
        minute=body.minute,
        timezone=body.timezone,
        channels=body.channels,
        email_to=body.email_to,
        whatsapp_to=body.whatsapp_to,
        is_active=True,
        next_run_at=next_run,
    )
    session.add(report)
    await session.commit()
    
    return {
        "success": True,
        "data": scheduled_report_to_dict(report),
        "message": "Zamanlanmış rapor oluşturuldu.",
    }


@router.get("/{report_id}")
async def get_scheduled_report(
    report_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Tekil zamanlanmış rapor detayı."""
    result = await session.execute(
        select(ScheduledReport).where(ScheduledReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    
    return {"data": scheduled_report_to_dict(report)}


@router.put("/{report_id}")
async def update_scheduled_report(
    report_id: str,
    body: ScheduledReportUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Zamanlanmış raporu güncelle."""
    result = await session.execute(
        select(ScheduledReport).where(ScheduledReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    
    update_data = body.model_dump(exclude_unset=True)
    
    # Zamanlama değiştiyse next_run_at'i güncelle
    time_fields = ["frequency", "day_of_week", "day_of_month", "hour", "minute"]
    time_changed = any(f in update_data for f in time_fields)
    
    for field, value in update_data.items():
        setattr(report, field, value)
    
    if time_changed:
        report.next_run_at = calculate_next_run(
            frequency=report.frequency,
            day_of_week=report.day_of_week,
            day_of_month=report.day_of_month,
            hour=report.hour,
            minute=report.minute,
        )
    
    await session.commit()
    return {
        "success": True,
        "data": scheduled_report_to_dict(report),
        "message": "Rapor güncellendi.",
    }


@router.delete("/{report_id}")
async def delete_scheduled_report(
    report_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Zamanlanmış raporu sil."""
    result = await session.execute(
        select(ScheduledReport).where(ScheduledReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    
    await session.delete(report)
    await session.commit()
    return {"success": True, "message": "Rapor silindi."}


@router.post("/{report_id}/toggle")
async def toggle_scheduled_report(
    report_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Raporu aktif/pasif yap."""
    result = await session.execute(
        select(ScheduledReport).where(ScheduledReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    
    report.is_active = not report.is_active
    
    # Aktif edildiyse next_run_at'i güncelle
    if report.is_active:
        report.next_run_at = calculate_next_run(
            frequency=report.frequency,
            day_of_week=report.day_of_week,
            day_of_month=report.day_of_month,
            hour=report.hour,
            minute=report.minute,
        )
    else:
        report.next_run_at = None
    
    await session.commit()
    
    return {
        "success": True,
        "is_active": report.is_active,
        "message": f"Rapor {'aktif' if report.is_active else 'pasif'} yapıldı.",
    }


@router.post("/{report_id}/run-now")
async def run_scheduled_report_now(
    report_id: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Zamanlanmış raporu hemen çalıştır (manuel tetikleme).
    Bu endpoint raporu senkron çalıştırır, sonucu döner.
    """
    from app.tasks import generate_scheduled_report_task
    
    result = await session.execute(
        select(ScheduledReport).where(ScheduledReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    
    # Celery task'ını çağır (senkron bekle)
    import asyncio
    task_result = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: generate_scheduled_report_task.delay(report_id)
    )
    
    return {
        "success": True,
        "task_id": task_result.id,
        "message": "Rapor görevi başlatıldı.",
    }


# ============ Logs Endpoint'leri ============

@router.get("/{report_id}/logs")
async def get_report_logs(
    report_id: str,
    session: AsyncSession = Depends(get_session),
    limit: int = Query(20, ge=1, le=100),
):
    """Zamanlanmış raporun çalışma geçmişi."""
    stmt = (
        select(ScheduledReportLog)
        .where(ScheduledReportLog.scheduled_report_id == report_id)
        .order_by(desc(ScheduledReportLog.started_at))
        .limit(limit)
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()
    
    return {
        "data": [scheduled_report_log_to_dict(r) for r in rows],
        "count": len(rows),
    }


@router.get("/logs/recent")
async def get_recent_logs(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(50, ge=1, le=200),
):
    """Tüm raporların son çalışma geçmişi."""
    stmt = (
        select(ScheduledReportLog)
        .order_by(desc(ScheduledReportLog.started_at))
        .limit(limit)
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()
    
    return {
        "data": [scheduled_report_log_to_dict(r) for r in rows],
        "count": len(rows),
    }


# ============ Metadata Endpoint'leri ============

@router.get("/metadata/frequencies")
async def get_frequencies():
    """Kullanılabilir frekanslar ve örnekler."""
    return {
        "frequencies": [
            {
                "id": "daily",
                "name": "Günlük",
                "description": "Her gün belirtilen saatte",
                "examples": ["Her gün saat 09:00"],
            },
            {
                "id": "weekly",
                "name": "Haftalık",
                "description": "Her hafta belirtilen günde",
                "examples": ["Her Pazartesi saat 09:00", "Her Cuma saat 18:00"],
            },
            {
                "id": "monthly",
                "name": "Aylık",
                "description": "Her ay belirtilen günde",
                "examples": ["Her ayın 1'inde saat 09:00"],
            },
        ],
        "days_of_week": [
            {"id": 0, "name": "Pazar"},
            {"id": 1, "name": "Pazartesi"},
            {"id": 2, "name": "Salı"},
            {"id": 3, "name": "Çarşamba"},
            {"id": 4, "name": "Perşembe"},
            {"id": 5, "name": "Cuma"},
            {"id": 6, "name": "Cumartesi"},
        ],
        "report_types": [
            {
                "id": "daily_summary",
                "name": "Günlük Özet",
                "description": "Son 24 saatin performans özeti",
            },
            {
                "id": "weekly_summary",
                "name": "Haftalık Özet",
                "description": "Son 7 günün detaylı analizi + AI önerileri",
            },
            {
                "id": "campaign_list",
                "name": "Kampanya Listesi",
                "description": "Aktif kampanyaların durumu",
            },
            {
                "id": "performance",
                "name": "Performans Analizi",
                "description": "Metrik bazlı derinlemesine analiz",
            },
        ],
        "hours": list(range(24)),
        "minutes": [0, 15, 30, 45],
    }


# ============ Helper Functions ============

def calculate_next_run(
    frequency: str,
    day_of_week: Optional[int],
    day_of_month: Optional[int],
    hour: int,
    minute: int,
) -> datetime:
    """Bir sonraki çalışma zamanını hesapla."""
    now = datetime.utcnow()
    
    # Bugün hedef saat
    target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    if frequency == "daily":
        if target <= now:
            target += timedelta(days=1)
        return target
    
    elif frequency == "weekly":
        # Haftanın günü (0=Pazar)
        days_until = (day_of_week - now.weekday()) % 7
        if days_until == 0 and target <= now:
            days_until = 7
        target += timedelta(days=days_until)
        return target
    
    elif frequency == "monthly":
        # Ayın günü
        try:
            target = target.replace(day=day_of_month)
        except ValueError:
            # Ayda o gün yok (örn: 31 Şubat)
            # O ayın son gününe ayarla
            import calendar
            last_day = calendar.monthrange(now.year, now.month)[1]
            target = target.replace(day=min(day_of_month, last_day))
        
        if target <= now:
            # Bir sonraki aya geç
            if now.month == 12:
                target = target.replace(year=now.year + 1, month=1)
            else:
                target = target.replace(month=now.month + 1)
        return target
    
    return now
