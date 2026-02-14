# -*- coding: utf-8 -*-
"""PostgreSQL modelleri: kayıtlı raporlar ve rapor CSV dosya kayıtları."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from sqlalchemy import JSON, DateTime, String, Text, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


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
