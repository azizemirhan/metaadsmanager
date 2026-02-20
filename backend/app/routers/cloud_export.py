# -*- coding: utf-8 -*-
"""Cloud Export: AWS S3 ve Google Cloud Storage entegrasyonu."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import CurrentUser, RequireAdmin
from app.models import CloudExportJob, cloud_export_job_to_dict
from app.services.cloud_export_service import cloud_export_service, CloudExportError
from app import config

router = APIRouter(prefix="/api/cloud-export", tags=["Cloud Export"])

REPORTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "reports")


# ──────────────────────────────────────────────────────────────────────────────
# Yapılandırma
# ──────────────────────────────────────────────────────────────────────────────

CLOUD_CONFIG_KEYS = {
    "s3": ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "CLOUD_BUCKET_S3"],
    "gcs": ["GCS_PROJECT_ID", "GCS_CREDENTIALS_JSON", "CLOUD_BUCKET_GCS"],
    "general": ["CLOUD_PROVIDER", "CLOUD_AUTO_ARCHIVE", "CLOUD_ARCHIVE_PREFIX", "CLOUD_RETENTION_DAYS"],
}


@router.get("/config")
async def get_cloud_config(_: CurrentUser):
    """Mevcut bulut yapılandırmasını döner (kimlik bilgileri maskelenir)."""
    provider = config.get_setting("CLOUD_PROVIDER") or "s3"

    def _mask(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        if len(value) > 8:
            return value[:4] + "****" + value[-4:]
        return "****"

    s3_cfg = {
        "access_key_id": _mask(config.get_setting("AWS_ACCESS_KEY_ID")),
        "secret_access_key": _mask(config.get_setting("AWS_SECRET_ACCESS_KEY")),
        "region": config.get_setting("AWS_REGION") or "us-east-1",
        "bucket": config.get_setting("CLOUD_BUCKET_S3"),
    }
    gcs_cfg = {
        "project_id": config.get_setting("GCS_PROJECT_ID"),
        "credentials_json": _mask(config.get_setting("GCS_CREDENTIALS_JSON")),
        "bucket": config.get_setting("CLOUD_BUCKET_GCS"),
    }
    archive_cfg = {
        "auto_archive": (config.get_setting("CLOUD_AUTO_ARCHIVE") or "false").lower() == "true",
        "prefix": config.get_setting("CLOUD_ARCHIVE_PREFIX") or "meta-ads-archive/",
        "retention_days": int(config.get_setting("CLOUD_RETENTION_DAYS") or "90"),
    }

    return {
        "provider": provider,
        "s3": s3_cfg,
        "gcs": gcs_cfg,
        "archive": archive_cfg,
        "supported_providers": ["s3", "gcs"],
    }


class CloudConfigUpdate(BaseModel):
    provider: Optional[str] = None
    # S3
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: Optional[str] = None
    bucket_s3: Optional[str] = None
    # GCS
    gcs_project_id: Optional[str] = None
    gcs_credentials_json: Optional[str] = None
    bucket_gcs: Optional[str] = None
    # Archive
    auto_archive: Optional[bool] = None
    archive_prefix: Optional[str] = None
    retention_days: Optional[int] = None


@router.put("/config")
async def update_cloud_config(body: CloudConfigUpdate, _: RequireAdmin):
    """Bulut yapılandırmasını günceller (yalnızca admin)."""
    mapping = {
        "CLOUD_PROVIDER": body.provider,
        "AWS_ACCESS_KEY_ID": body.aws_access_key_id,
        "AWS_SECRET_ACCESS_KEY": body.aws_secret_access_key,
        "AWS_REGION": body.aws_region,
        "CLOUD_BUCKET_S3": body.bucket_s3,
        "GCS_PROJECT_ID": body.gcs_project_id,
        "GCS_CREDENTIALS_JSON": body.gcs_credentials_json,
        "CLOUD_BUCKET_GCS": body.bucket_gcs,
        "CLOUD_AUTO_ARCHIVE": str(body.auto_archive).lower() if body.auto_archive is not None else None,
        "CLOUD_ARCHIVE_PREFIX": body.archive_prefix,
        "CLOUD_RETENTION_DAYS": str(body.retention_days) if body.retention_days else None,
    }
    updated = []
    for key, value in mapping.items():
        if value is not None:
            config.set_setting(key, value)
            updated.append(key)
    return {"success": True, "updated_keys": updated}


class TestConnectionBody(BaseModel):
    provider: str
    bucket: str


@router.post("/test")
async def test_connection(body: TestConnectionBody, _: CurrentUser):
    """Bulut bağlantısını test eder."""
    result = await cloud_export_service.test_connection(body.provider, body.bucket)
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Export İşleri
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/jobs")
async def list_export_jobs(
    _: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: int = Query(50, ge=1, le=200),
):
    stmt = select(CloudExportJob).order_by(desc(CloudExportJob.created_at)).limit(limit)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return {"data": [cloud_export_job_to_dict(r) for r in rows], "count": len(rows)}


class ExportBody(BaseModel):
    file_path: str  # Sunucudaki yerel dosya yolu (data/reports/... gibi)
    object_key: Optional[str] = None  # Buluttaki yol; boşsa dosya adı kullanılır
    provider: Optional[str] = None  # None → ayardan alınır
    bucket: Optional[str] = None    # None → ayardan alınır


@router.post("/export")
async def trigger_export(
    body: ExportBody,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Belirli bir dosyayı buluta yükler."""
    provider = body.provider or config.get_setting("CLOUD_PROVIDER") or "s3"
    bucket_key = "CLOUD_BUCKET_S3" if provider == "s3" else "CLOUD_BUCKET_GCS"
    bucket = body.bucket or config.get_setting(bucket_key)

    if not bucket:
        raise HTTPException(status_code=400, detail="Bucket adı gerekli. Yapılandırmadan ayarlayın.")

    object_key = body.object_key or Path(body.file_path).name
    prefix = config.get_setting("CLOUD_ARCHIVE_PREFIX") or "meta-ads-archive/"
    if not object_key.startswith(prefix) and "/" not in object_key:
        object_key = prefix + object_key

    job = CloudExportJob(
        id=str(uuid.uuid4()),
        provider=provider,
        bucket=bucket,
        object_key=object_key,
        file_path=body.file_path,
        status="running",
    )
    session.add(job)
    await session.flush()

    try:
        result = await cloud_export_service.upload(body.file_path, bucket, object_key, provider)
        job.status = "completed"
        job.file_size_bytes = result.get("file_size_bytes")
        job.completed_at = datetime.now(timezone.utc)
        await session.flush()
        return {"success": True, "job": cloud_export_job_to_dict(job), "upload_result": result}
    except CloudExportError as e:
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        await session.flush()
        raise HTTPException(status_code=503, detail=str(e))


class ArchiveBody(BaseModel):
    provider: Optional[str] = None
    bucket: Optional[str] = None
    prefix: Optional[str] = None
    reports_dir: Optional[str] = None


@router.post("/archive")
async def archive_reports(
    body: ArchiveBody,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Tüm rapor dosyalarını buluta arşivler."""
    provider = body.provider or config.get_setting("CLOUD_PROVIDER") or "s3"
    bucket_key = "CLOUD_BUCKET_S3" if provider == "s3" else "CLOUD_BUCKET_GCS"
    bucket = body.bucket or config.get_setting(bucket_key)

    if not bucket:
        raise HTTPException(status_code=400, detail="Bucket adı gerekli.")

    prefix = body.prefix or config.get_setting("CLOUD_ARCHIVE_PREFIX") or "meta-ads-archive/"
    reports_dir = body.reports_dir or REPORTS_DIR

    # Ana job kaydı
    job = CloudExportJob(
        id=str(uuid.uuid4()),
        provider=provider,
        bucket=bucket,
        object_key=f"{prefix}archive/",
        file_path=reports_dir,
        status="running",
    )
    session.add(job)
    await session.flush()

    try:
        result = await cloud_export_service.archive_reports_directory(
            reports_dir, provider, bucket, prefix
        )
        job.status = "completed"
        job.file_size_bytes = sum(f.get("size", 0) or 0 for f in result.get("files", []))
        job.completed_at = datetime.now(timezone.utc)
        await session.flush()
        return {"success": True, "job_id": job.id, **result}
    except CloudExportError as e:
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        await session.flush()
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/archive-settings")
async def get_archive_settings(_: CurrentUser):
    return {
        "auto_archive": (config.get_setting("CLOUD_AUTO_ARCHIVE") or "false").lower() == "true",
        "prefix": config.get_setting("CLOUD_ARCHIVE_PREFIX") or "meta-ads-archive/",
        "retention_days": int(config.get_setting("CLOUD_RETENTION_DAYS") or "90"),
        "provider": config.get_setting("CLOUD_PROVIDER") or "s3",
    }


class ArchiveSettingsBody(BaseModel):
    auto_archive: bool
    prefix: Optional[str] = None
    retention_days: Optional[int] = None


@router.put("/archive-settings")
async def update_archive_settings(body: ArchiveSettingsBody, _: CurrentUser):
    config.set_setting("CLOUD_AUTO_ARCHIVE", str(body.auto_archive).lower())
    if body.prefix:
        config.set_setting("CLOUD_ARCHIVE_PREFIX", body.prefix)
    if body.retention_days is not None:
        config.set_setting("CLOUD_RETENTION_DAYS", str(body.retention_days))
    return {"success": True}
