# -*- coding: utf-8 -*-
"""Arka plan iş durumu: sync engine ile Celery worker günceller; API async session ile okur."""

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, Session

from app import config
from app.models import Base, JobStatus

_sync_engine = None
_SyncSession = None


def _get_sync_engine():
    global _sync_engine
    if _sync_engine is not None:
        return _sync_engine
    url = config.DATABASE_URL_SYNC
    if not url:
        return None
    _sync_engine = create_engine(url, pool_pre_ping=True)
    return _sync_engine


def get_sync_session() -> Optional[Session]:
    """Celery worker içinde job durumu güncellemek için sync session."""
    global _SyncSession
    engine = _get_sync_engine()
    if not engine:
        return None
    if _SyncSession is None:
        _SyncSession = sessionmaker(engine, expire_on_commit=False, autocommit=False, autoflush=False)
    return _SyncSession()


def create_job_sync(report_id: str, job_type: str) -> Optional[str]:
    """Yeni job kaydı oluşturur, job_id döner."""
    session = get_sync_session()
    if not session:
        return None
    job_id = str(uuid.uuid4())
    try:
        job = JobStatus(
            id=job_id,
            report_id=report_id,
            job_type=job_type,
            status="pending",
            progress=0,
        )
        session.add(job)
        session.commit()
        return job_id
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def update_job_sync(
    job_id: str,
    *,
    status: Optional[str] = None,
    progress: Optional[int] = None,
    result_text: Optional[str] = None,
    file_path: Optional[str] = None,
    file_name: Optional[str] = None,
    error_message: Optional[str] = None,
) -> None:
    """Job durumunu günceller (Celery worker sync)."""
    session = get_sync_session()
    if not session:
        return
    try:
        row = session.execute(select(JobStatus).where(JobStatus.id == job_id)).scalar_one_or_none()
        if not row:
            return
        if status is not None:
            row.status = status
        if progress is not None:
            row.progress = min(100, max(0, progress))
        if result_text is not None:
            row.result_text = result_text
        if file_path is not None:
            row.file_path = file_path
        if file_name is not None:
            row.file_name = file_name
        if error_message is not None:
            row.error_message = error_message
        row.updated_at = datetime.utcnow()
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def job_to_dict(row: JobStatus) -> dict[str, Any]:
    """ORM JobStatus -> API dict."""
    return {
        "id": row.id,
        "report_id": row.report_id,
        "job_type": row.job_type,
        "status": row.status,
        "progress": row.progress,
        "result_text": row.result_text,
        "file_path": row.file_path,
        "file_name": row.file_name,
        "error_message": row.error_message,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
