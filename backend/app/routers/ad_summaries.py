# -*- coding: utf-8 -*-
"""Kayıtlı reklam oluşturma özetleri."""

import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session_optional, get_session
from app.models import SavedAdSummary

router = APIRouter(tags=["Ad Summaries"])

SAVED_SUMMARIES_FILE = Path(__file__).resolve().parent.parent.parent / "saved_ad_summaries.json"


class SaveAdSummaryBody(BaseModel):
    name: str
    summary_text: str


def _load_json() -> list[dict]:
    if not SAVED_SUMMARIES_FILE.exists():
        return []
    try:
        with open(SAVED_SUMMARIES_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("summaries", [])
    except Exception:
        return []


def _save_json(summaries: list[dict]) -> None:
    SAVED_SUMMARIES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SAVED_SUMMARIES_FILE, "w", encoding="utf-8") as f:
        json.dump({"summaries": summaries}, f, ensure_ascii=False, indent=2)


@router.get("")
async def list_ad_summaries(session: Optional[AsyncSession] = Depends(get_db_session_optional)):
    """Kayıtlı reklam özetlerini listeler."""
    if session is not None:
        result = await session.execute(
            select(SavedAdSummary).order_by(SavedAdSummary.created_at.desc())
        )
        rows = result.scalars().all()
        data = [
            {
                "id": r.id,
                "name": r.name,
                "summary_text": r.summary_text,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    else:
        summaries = _load_json()
        data = sorted(summaries, key=lambda x: x.get("created_at", ""), reverse=True)
    return {"data": data, "count": len(data)}


@router.get("/{summary_id}")
async def get_ad_summary(
    summary_id: str,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Tek bir kayıtlı özeti getirir."""
    if session is not None:
        result = await session.execute(select(SavedAdSummary).where(SavedAdSummary.id == summary_id))
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Özet bulunamadı")
        return {
            "id": row.id,
            "name": row.name,
            "summary_text": row.summary_text,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
    summaries = _load_json()
    found = next((s for s in summaries if s.get("id") == summary_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Özet bulunamadı")
    return found


@router.post("")
async def save_ad_summary(
    body: SaveAdSummaryBody,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Reklam özetini kaydeder."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Özet adı girin.")
    if not body.summary_text.strip():
        raise HTTPException(status_code=400, detail="Özet metni boş olamaz.")
    summary_id = str(uuid.uuid4())[:8]
    if session is not None:
        from datetime import datetime
        row = SavedAdSummary(
            id=summary_id,
            name=body.name.strip(),
            summary_text=body.summary_text,
        )
        session.add(row)
        await session.flush()
        return {
            "success": True,
            "id": row.id,
            "name": row.name,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
    summaries = _load_json()
    from datetime import datetime
    summaries.insert(
        0,
        {
            "id": summary_id,
            "name": body.name.strip(),
            "summary_text": body.summary_text,
            "created_at": datetime.utcnow().isoformat() + "Z",
        },
    )
    _save_json(summaries)
    return {
        "success": True,
        "id": summary_id,
        "name": body.name.strip(),
        "created_at": summaries[0]["created_at"],
    }


@router.delete("/{summary_id}")
async def delete_ad_summary(
    summary_id: str,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Kayıtlı özeti siler."""
    if session is not None:
        result = await session.execute(select(SavedAdSummary).where(SavedAdSummary.id == summary_id))
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Özet bulunamadı")
        await session.delete(row)
        return {"success": True, "id": summary_id}
    summaries = _load_json()
    new_list = [s for s in summaries if s.get("id") != summary_id]
    if len(new_list) == len(summaries):
        raise HTTPException(status_code=404, detail="Özet bulunamadı")
    _save_json(new_list)
    return {"success": True, "id": summary_id}
