# -*- coding: utf-8 -*-
"""Kayıtlı raporlar: PostgreSQL (tercih) veya JSON dosyası."""

import json
from pathlib import Path
from typing import Any, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import is_db_configured
from app.models import SavedReport, saved_report_to_dict

SAVED_REPORTS_FILE = Path(__file__).resolve().parent.parent / "saved_reports.json"


# --- JSON fallback (DATABASE_URL yoksa) ---
def load_saved_reports() -> List[dict]:
    if not SAVED_REPORTS_FILE.exists():
        return []
    try:
        with open(SAVED_REPORTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("reports", [])
    except Exception:
        return []


def save_saved_reports(reports: List[dict]) -> None:
    SAVED_REPORTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SAVED_REPORTS_FILE, "w", encoding="utf-8") as f:
        json.dump({"reports": reports}, f, ensure_ascii=False, indent=2)


def get_saved_report_by_id(report_id: str) -> Optional[dict]:
    for r in load_saved_reports():
        if r.get("id") == report_id:
            return r
    return None


# --- PostgreSQL (DATABASE_URL varsa) ---
async def load_saved_reports_db(session: AsyncSession) -> List[dict]:
    result = await session.execute(select(SavedReport).order_by(SavedReport.created_at.desc()))
    rows = result.scalars().all()
    return [saved_report_to_dict(r) for r in rows]


async def get_saved_report_by_id_db(session: AsyncSession, report_id: str) -> Optional[dict]:
    result = await session.execute(select(SavedReport).where(SavedReport.id == report_id))
    row = result.scalar_one_or_none()
    return saved_report_to_dict(row) if row else None


async def create_saved_report_db(
    session: AsyncSession,
    report_id: str,
    name: str,
    template_ids: List[str],
    days: int = 30,
    ad_account_id: Optional[str] = None,
) -> dict:
    r = SavedReport(
        id=report_id,
        name=name,
        template_ids=template_ids,
        days=days,
        ad_account_id=ad_account_id,
    )
    session.add(r)
    await session.flush()
    return saved_report_to_dict(r)


async def delete_saved_report_db(session: AsyncSession, report_id: str) -> bool:
    result = await session.execute(select(SavedReport).where(SavedReport.id == report_id))
    row = result.scalar_one_or_none()
    if not row:
        return False
    await session.delete(row)
    return True


async def get_saved_report_by_id_optional(
    session: Optional[AsyncSession], report_id: str
) -> Optional[dict]:
    """Session varsa DB'den, yoksa JSON dosyasından rapor getirir."""
    if session is not None:
        return await get_saved_report_by_id_db(session, report_id)
    return get_saved_report_by_id(report_id)
