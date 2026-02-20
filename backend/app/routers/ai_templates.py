# -*- coding: utf-8 -*-
"""AI Geliştirmeleri: özelleştirilebilir analiz şablonları, trend hafızası, çok dilli çıktı."""
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
from app.models import AIAnalysisTemplate, AIContextEntry, ai_template_to_dict, ai_context_entry_to_dict
from app import config

router = APIRouter(prefix="/api/ai-templates", tags=["AI Templates"])

# ─── Sabit değerler ────────────────────────────────────────────────────────

CONTEXT_TYPES = ["general", "campaign", "weekly", "forecast", "anomaly"]
LANGUAGES = {
    "tr": "Türkçe",
    "en": "English",
    "de": "Deutsch",
    "fr": "Français",
    "es": "Español",
    "ar": "العربية",
    "pt": "Português",
}

LANGUAGE_SETTING_KEY = "AI_OUTPUT_LANGUAGE"

DEFAULT_TEMPLATES = [
    {
        "name": "Genel Kampanya Analizi (TR)",
        "context_type": "general",
        "language": "tr",
        "description": "Meta reklam kampanyalarını Türkçe analiz eder.",
        "prompt_template": (
            "Sen deneyimli bir Meta Ads uzmanısın. Aşağıdaki kampanya verilerini analiz et ve "
            "Türkçe olarak şunları sun:\n"
            "1. Genel performans özeti\n"
            "2. En iyi ve en kötü performanslı kampanyalar\n"
            "3. Bütçe optimizasyon önerileri\n"
            "4. CTR ve ROAS iyileştirme tavsiyeleri\n"
            "5. Öncelikli aksiyon adımları\n\n"
            "Veri: {data}"
        ),
        "is_default": True,
    },
    {
        "name": "Campaign Analysis (EN)",
        "context_type": "general",
        "language": "en",
        "description": "Analyzes Meta ad campaigns in English.",
        "prompt_template": (
            "You are an experienced Meta Ads specialist. Analyze the campaign data below and provide:\n"
            "1. Overall performance summary\n"
            "2. Top and underperforming campaigns\n"
            "3. Budget optimization recommendations\n"
            "4. CTR and ROAS improvement suggestions\n"
            "5. Priority action steps\n\n"
            "Data: {data}"
        ),
        "is_default": False,
    },
    {
        "name": "Haftalık Özet Şablonu",
        "context_type": "weekly",
        "language": "tr",
        "description": "Haftalık performans raporu için AI şablonu.",
        "prompt_template": (
            "Bu haftaki Meta reklam performansını analiz et. Geçen haftayla karşılaştır ve:\n"
            "- Harcama trendi\n"
            "- ROAS değişimi\n"
            "- En dikkat çekici gelişme\n"
            "- Gelecek hafta için 3 öneri\n"
            "Veri: {data}"
        ),
        "is_default": False,
    },
    {
        "name": "Tahmin Analizi",
        "context_type": "forecast",
        "language": "tr",
        "description": "Bütçe tahminleri için özelleştirilmiş şablon.",
        "prompt_template": (
            "Aşağıdaki geçmiş reklam harcaması verilerine dayanarak:\n"
            "1. Bu ayın toplam harcama tahmini\n"
            "2. Beklenen ROAS aralığı\n"
            "3. Dikkat edilmesi gereken riskler\n"
            "4. Bütçe artışı veya kısma önerisi\n"
            "Veri: {data}"
        ),
        "is_default": False,
    },
]


# ══════════════════════════════════════════════════════════════════════════════
# AI Analysis Templates
# ══════════════════════════════════════════════════════════════════════════════

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    context_type: str = "general"
    prompt_template: str
    language: str = "tr"
    is_default: bool = False


@router.get("/templates")
async def list_templates(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    context_type: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
):
    stmt = select(AIAnalysisTemplate).order_by(desc(AIAnalysisTemplate.created_at))
    if context_type:
        stmt = stmt.where(AIAnalysisTemplate.context_type == context_type)
    if language:
        stmt = stmt.where(AIAnalysisTemplate.language == language)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return {"data": [ai_template_to_dict(r) for r in rows], "count": len(rows)}


@router.post("/templates")
async def create_template(
    body: TemplateCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if body.context_type not in CONTEXT_TYPES:
        raise HTTPException(status_code=400, detail=f"Geçersiz context_type. Geçerli: {CONTEXT_TYPES}")
    if body.language not in LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Desteklenmeyen dil. Geçerli: {list(LANGUAGES.keys())}")
    if not body.prompt_template.strip():
        raise HTTPException(status_code=400, detail="Şablon metni boş olamaz.")

    # Varsayılan olarak işaretlenirse öncekini kaldır
    if body.is_default:
        result = await session.execute(
            select(AIAnalysisTemplate).where(
                AIAnalysisTemplate.context_type == body.context_type,
                AIAnalysisTemplate.is_default == True,
            )
        )
        for old in result.scalars().all():
            old.is_default = False

    template = AIAnalysisTemplate(
        id=str(uuid.uuid4()),
        name=body.name.strip(),
        description=body.description,
        context_type=body.context_type,
        prompt_template=body.prompt_template.strip(),
        language=body.language,
        is_default=body.is_default,
        created_by=current_user.id,
    )
    session.add(template)
    await session.flush()
    return {"success": True, "data": ai_template_to_dict(template)}


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(AIAnalysisTemplate).where(AIAnalysisTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı.")
    return {"data": ai_template_to_dict(template)}


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    body: TemplateCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(AIAnalysisTemplate).where(AIAnalysisTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı.")

    if body.is_default and not template.is_default:
        existing = await session.execute(
            select(AIAnalysisTemplate).where(
                AIAnalysisTemplate.context_type == body.context_type,
                AIAnalysisTemplate.is_default == True,
                AIAnalysisTemplate.id != template_id,
            )
        )
        for old in existing.scalars().all():
            old.is_default = False

    template.name = body.name.strip()
    template.description = body.description
    template.context_type = body.context_type
    template.prompt_template = body.prompt_template.strip()
    template.language = body.language
    template.is_default = body.is_default
    template.updated_at = datetime.now(timezone.utc)
    await session.flush()
    return {"success": True, "data": ai_template_to_dict(template)}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(AIAnalysisTemplate).where(AIAnalysisTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı.")
    await session.delete(template)
    await session.flush()
    return {"success": True, "message": "Şablon silindi."}


@router.post("/templates/seed-defaults")
async def seed_default_templates(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Varsayılan şablonları DB'ye ekler (bir kez çalıştırılmalı)."""
    added = []
    for t in DEFAULT_TEMPLATES:
        result = await session.execute(
            select(AIAnalysisTemplate).where(AIAnalysisTemplate.name == t["name"])
        )
        if not result.scalar_one_or_none():
            template = AIAnalysisTemplate(
                id=str(uuid.uuid4()),
                created_by=current_user.id,
                **t,
            )
            session.add(template)
            added.append(t["name"])
    await session.flush()
    return {"success": True, "added": added, "skipped": len(DEFAULT_TEMPLATES) - len(added)}


# ══════════════════════════════════════════════════════════════════════════════
# Trend Memory (AI Bağlam Hafızası)
# ══════════════════════════════════════════════════════════════════════════════

class ContextEntryCreate(BaseModel):
    context_type: str = "weekly_summary"
    period_label: str
    key_metrics: Optional[dict] = None
    insights: str
    ad_account_id: Optional[str] = None


@router.get("/context-entries")
async def list_context_entries(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    context_type: Optional[str] = Query(None),
    ad_account_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    stmt = select(AIContextEntry).order_by(desc(AIContextEntry.created_at)).limit(limit)
    if context_type:
        stmt = stmt.where(AIContextEntry.context_type == context_type)
    if ad_account_id:
        stmt = stmt.where(AIContextEntry.ad_account_id == ad_account_id)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return {"data": [ai_context_entry_to_dict(r) for r in rows], "count": len(rows)}


@router.post("/context-entries")
async def create_context_entry(
    body: ContextEntryCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    entry = AIContextEntry(
        id=str(uuid.uuid4()),
        context_type=body.context_type,
        period_label=body.period_label.strip(),
        key_metrics=body.key_metrics,
        insights=body.insights.strip(),
        ad_account_id=body.ad_account_id,
    )
    session.add(entry)
    await session.flush()
    return {"success": True, "data": ai_context_entry_to_dict(entry)}


@router.delete("/context-entries/{entry_id}")
async def delete_context_entry(
    entry_id: str,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(AIContextEntry).where(AIContextEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Bağlam girdisi bulunamadı.")
    await session.delete(entry)
    await session.flush()
    return {"success": True}


@router.get("/context-entries/summary")
async def context_summary(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    ad_account_id: Optional[str] = Query(None),
    last_n: int = Query(10, ge=1, le=50),
):
    """Son N girdiyi AI'ya bağlam olarak hazır metin formatında döner."""
    stmt = select(AIContextEntry).order_by(desc(AIContextEntry.created_at)).limit(last_n)
    if ad_account_id:
        stmt = stmt.where(AIContextEntry.ad_account_id == ad_account_id)
    result = await session.execute(stmt)
    rows = result.scalars().all()

    lines = []
    for r in reversed(rows):
        metrics_str = ""
        if r.key_metrics:
            metrics_str = " | ".join(f"{k}: {v}" for k, v in r.key_metrics.items())
        lines.append(f"[{r.period_label} / {r.context_type}] {metrics_str}\n→ {r.insights}")

    summary = "\n\n".join(lines) if lines else "Geçmiş bağlam bulunmuyor."
    return {"summary": summary, "entry_count": len(rows)}


# ══════════════════════════════════════════════════════════════════════════════
# Dil Ayarı
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/language")
async def get_language(_: CurrentUser):
    """Mevcut AI çıktı dilini döner."""
    lang = config.get_setting(LANGUAGE_SETTING_KEY) or "tr"
    return {"language": lang, "language_name": LANGUAGES.get(lang, lang), "available": LANGUAGES}


class LanguageBody(BaseModel):
    language: str


@router.put("/language")
async def set_language(body: LanguageBody, _: CurrentUser):
    """AI çıktı dilini günceller."""
    if body.language not in LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Desteklenmeyen dil. Geçerli: {list(LANGUAGES.keys())}")
    config.set_setting(LANGUAGE_SETTING_KEY, body.language)
    return {"success": True, "language": body.language, "language_name": LANGUAGES[body.language]}


@router.get("/meta")
async def get_meta(_: CurrentUser):
    """Şablon türleri, desteklenen diller ve değişken listesi döner."""
    return {
        "context_types": [
            {"id": "general", "name": "Genel Analiz"},
            {"id": "campaign", "name": "Kampanya Analizi"},
            {"id": "weekly", "name": "Haftalık Özet"},
            {"id": "forecast", "name": "Tahmin"},
            {"id": "anomaly", "name": "Anomali Tespiti"},
        ],
        "languages": [{"code": k, "name": v} for k, v in LANGUAGES.items()],
        "template_variables": [
            {"var": "{data}", "description": "Kampanya metrikleri (JSON formatında)"},
            {"var": "{account_id}", "description": "Reklam hesabı ID"},
            {"var": "{period}", "description": "Analiz periyodu (örn. 'Son 30 gün')"},
            {"var": "{context}", "description": "Tarihsel bağlam özeti (trend hafızası)"},
        ],
    }
