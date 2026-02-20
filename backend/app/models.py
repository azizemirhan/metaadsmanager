# -*- coding: utf-8 -*-
"""PostgreSQL modelleri: kullanıcılar, roller, kayıtlı raporlar ve rapor CSV dosya kayıtları."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from sqlalchemy import JSON, DateTime, String, Text, ForeignKey, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# Roller: admin (tüm yetkiler + kullanıcı yönetimi), manager (düzenleme/silme), viewer (sadece okuma)
USER_ROLES = ("admin", "manager", "viewer")


class Base(DeclarativeBase):
    pass


class User(Base):
    """Kullanıcı: giriş ve rol yönetimi."""
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(128), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="viewer")  # admin | manager | viewer
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class SavedReport(Base):
    """Hazır rapor tanımı (isim, şablon listesi, gün, reklam hesabı)."""
    __tablename__ = "saved_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    template_ids: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)  # ["tid1", "tid2"]
    days: Mapped[int] = mapped_column(default=30)
    ad_account_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    csv_files: Mapped[List["ReportCsvFile"]] = relationship(
        "ReportCsvFile", back_populates="report", cascade="all, delete-orphan"
    )


class ReportCsvFile(Base):
    """Rapor CSV'sinin yerel diske yazıldığı dosya kaydı."""
    __tablename__ = "report_csv_files"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    report_id: Mapped[str] = mapped_column(String(36), ForeignKey("saved_reports.id", ondelete="CASCADE"), nullable=False)
    template_id: Mapped[str] = mapped_column(String(128), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)  # Tam dosya yolu
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)  # Orijinal dosya adı
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    report: Mapped["SavedReport"] = relationship("SavedReport", back_populates="csv_files")


class SavedAdSummary(Base):
    """Kaydedilmiş reklam oluşturma özeti."""
    __tablename__ = "saved_ad_summaries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class JobStatus(Base):
    """Arka plan işi: export veya analyze. Celery worker ilerlemeyi bu tabloda günceller."""
    __tablename__ = "job_status"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    report_id: Mapped[str] = mapped_column(String(36), nullable=False)
    job_type: Mapped[str] = mapped_column(String(32), nullable=False)  # "export" | "analyze"
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # "pending" | "running" | "completed" | "failed"
    progress: Mapped[int] = mapped_column(default=0)  # 0-100
    result_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # analyze sonucu (metin)
    file_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # export: ZIP/CSV yolu
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # indirme adı
    pdf_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # analyze: PDF rapor yolu
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class AlertRule(Base):
    """Akıllı uyarı kuralı: Metrik, eşik, bildirim kanalları."""
    __tablename__ = "alert_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    metric: Mapped[str] = mapped_column(String(64), nullable=False)  # "ctr", "roas", "spend", "cpc", "cpm"
    condition: Mapped[str] = mapped_column(String(32), nullable=False)  # "lt" (küçükse), "gt" (büyükse), "change_pct" (değişim yüzde)
    threshold: Mapped[float] = mapped_column(nullable=False)
    ad_account_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    channels: Mapped[List[str]] = mapped_column(JSON, default=list)  # ["email", "whatsapp"]
    email_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    whatsapp_to: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    cooldown_minutes: Mapped[int] = mapped_column(default=60)  # Aynı uyarı için bekleme süresi
    last_triggered: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    trigger_count: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class AlertHistory(Base):
    """Tetiklenmiş uyarıların geçmişi."""
    __tablename__ = "alert_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    rule_id: Mapped[str] = mapped_column(String(36), ForeignKey("alert_rules.id", ondelete="CASCADE"), nullable=False)
    campaign_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    campaign_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    metric: Mapped[str] = mapped_column(String(64), nullable=False)
    threshold: Mapped[float] = mapped_column(nullable=False)
    actual_value: Mapped[float] = mapped_column(nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    channels_sent: Mapped[List[str]] = mapped_column(JSON, default=list)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class CampaignAutomationRule(Base):
    """Kampanya otomasyon kuralı: metrik eşiğine göre otomatik aksiyon alır."""
    __tablename__ = "campaign_automation_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Tetikleyici koşul
    metric: Mapped[str] = mapped_column(String(64), nullable=False)  # ctr, roas, spend, cpc, cpm, frequency
    condition: Mapped[str] = mapped_column(String(32), nullable=False)  # lt, gt
    threshold: Mapped[float] = mapped_column(nullable=False)

    # Aksiyon
    action: Mapped[str] = mapped_column(String(32), nullable=False)  # pause, resume, notify, budget_decrease, budget_increase
    action_value: Mapped[Optional[float]] = mapped_column(nullable=True)  # budget değişim yüzdesi (örn. 20 = %20)

    # Kapsam
    ad_account_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    campaign_ids: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)  # Boşsa tüm kampanyalar

    # Bildirim
    notify_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notify_whatsapp: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # Durum
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    cooldown_minutes: Mapped[int] = mapped_column(default=60)
    last_triggered: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    trigger_count: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class CampaignAutomationLog(Base):
    """Otomasyon kuralı çalıştırma geçmişi."""
    __tablename__ = "campaign_automation_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    rule_id: Mapped[str] = mapped_column(String(36), ForeignKey("campaign_automation_rules.id", ondelete="CASCADE"), nullable=False)
    campaign_id: Mapped[str] = mapped_column(String(64), nullable=False)
    campaign_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    action_taken: Mapped[str] = mapped_column(String(32), nullable=False)
    metric: Mapped[str] = mapped_column(String(64), nullable=False)
    threshold: Mapped[float] = mapped_column(nullable=False)
    actual_value: Mapped[float] = mapped_column(nullable=False)

    success: Mapped[bool] = mapped_column(Boolean, default=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


def automation_rule_to_dict(row: CampaignAutomationRule) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "metric": row.metric,
        "condition": row.condition,
        "threshold": row.threshold,
        "action": row.action,
        "action_value": row.action_value,
        "ad_account_id": row.ad_account_id,
        "campaign_ids": row.campaign_ids or [],
        "notify_email": row.notify_email,
        "notify_whatsapp": row.notify_whatsapp,
        "is_active": row.is_active,
        "cooldown_minutes": row.cooldown_minutes,
        "last_triggered": row.last_triggered.isoformat() if row.last_triggered else None,
        "trigger_count": row.trigger_count,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def automation_log_to_dict(row: CampaignAutomationLog) -> dict[str, Any]:
    return {
        "id": row.id,
        "rule_id": row.rule_id,
        "campaign_id": row.campaign_id,
        "campaign_name": row.campaign_name,
        "action_taken": row.action_taken,
        "metric": row.metric,
        "threshold": row.threshold,
        "actual_value": row.actual_value,
        "success": row.success,
        "message": row.message,
        "error": row.error,
        "executed_at": row.executed_at.isoformat() if row.executed_at else None,
    }


def saved_report_to_dict(row: SavedReport) -> dict[str, Any]:
    """ORM SavedReport -> API için dict."""
    return {
        "id": row.id,
        "name": row.name,
        "template_ids": row.template_ids or [],
        "days": row.days,
        "ad_account_id": row.ad_account_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def alert_rule_to_dict(row: AlertRule) -> dict[str, Any]:
    """ORM AlertRule -> API için dict."""
    return {
        "id": row.id,
        "name": row.name,
        "metric": row.metric,
        "condition": row.condition,
        "threshold": row.threshold,
        "ad_account_id": row.ad_account_id,
        "channels": row.channels or [],
        "email_to": row.email_to,
        "whatsapp_to": row.whatsapp_to,
        "is_active": row.is_active,
        "cooldown_minutes": row.cooldown_minutes,
        "last_triggered": row.last_triggered.isoformat() if row.last_triggered else None,
        "trigger_count": row.trigger_count,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


class ScheduledReport(Base):
    """Zamanlanmış otomatik rapor görevi."""
    __tablename__ = "scheduled_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # Rapor tipi ve periyot
    report_type: Mapped[str] = mapped_column(String(32), nullable=False)  # "weekly_summary", "campaign_list", "performance"
    days: Mapped[int] = mapped_column(default=7)  # Son kaç gün
    ad_account_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
    # Zamanlama (Crontab benzeri)
    frequency: Mapped[str] = mapped_column(String(16), nullable=False)  # "daily", "weekly", "monthly"
    day_of_week: Mapped[Optional[int]] = mapped_column(nullable=True)  # 0=Pazar, 1=Pazartesi (weekly için)
    day_of_month: Mapped[Optional[int]] = mapped_column(nullable=True)  # 1-31 (monthly için)
    hour: Mapped[int] = mapped_column(default=9)  # 0-23
    minute: Mapped[int] = mapped_column(default=0)  # 0-59
    timezone: Mapped[str] = mapped_column(default="Europe/Istanbul")
    
    # Bildirim kanalları
    channels: Mapped[List[str]] = mapped_column(JSON, default=list)  # ["email", "whatsapp"]
    email_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    whatsapp_to: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    
    # Durum
    is_active: Mapped[bool] = mapped_column(default=True)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    run_count: Mapped[int] = mapped_column(default=0)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class ScheduledReportLog(Base):
    """Zamanlanmış rapor çalışma geçmişi."""
    __tablename__ = "scheduled_report_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    scheduled_report_id: Mapped[str] = mapped_column(String(36), ForeignKey("scheduled_reports.id", ondelete="CASCADE"), nullable=False)
    
    status: Mapped[str] = mapped_column(String(32), nullable=False)  # "success", "failed", "running"
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Rapor içeriği
    summary_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ai_analysis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Gönderim durumu
    channels_sent: Mapped[List[str]] = mapped_column(JSON, default=list)


def alert_history_to_dict(row: AlertHistory) -> dict[str, Any]:
    """ORM AlertHistory -> API için dict."""
    return {
        "id": row.id,
        "rule_id": row.rule_id,
        "campaign_id": row.campaign_id,
        "campaign_name": row.campaign_name,
        "metric": row.metric,
        "threshold": row.threshold,
        "actual_value": row.actual_value,
        "message": row.message,
        "channels_sent": row.channels_sent or [],
        "sent_at": row.sent_at.isoformat() if row.sent_at else None,
    }


def scheduled_report_to_dict(row: ScheduledReport) -> dict[str, Any]:
    """ORM ScheduledReport -> API için dict."""
    return {
        "id": row.id,
        "name": row.name,
        "report_type": row.report_type,
        "days": row.days,
        "ad_account_id": row.ad_account_id,
        "frequency": row.frequency,
        "day_of_week": row.day_of_week,
        "day_of_month": row.day_of_month,
        "hour": row.hour,
        "minute": row.minute,
        "timezone": row.timezone,
        "channels": row.channels or [],
        "email_to": row.email_to,
        "whatsapp_to": row.whatsapp_to,
        "is_active": row.is_active,
        "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
        "next_run_at": row.next_run_at.isoformat() if row.next_run_at else None,
        "run_count": row.run_count,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def scheduled_report_log_to_dict(row: ScheduledReportLog) -> dict[str, Any]:
    """ORM ScheduledReportLog -> API için dict."""
    return {
        "id": row.id,
        "scheduled_report_id": row.scheduled_report_id,
        "status": row.status,
        "started_at": row.started_at.isoformat() if row.started_at else None,
        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
        "summary_data": row.summary_data,
        "ai_analysis": row.ai_analysis,
        "error_message": row.error_message,
        "channels_sent": row.channels_sent or [],
    }
