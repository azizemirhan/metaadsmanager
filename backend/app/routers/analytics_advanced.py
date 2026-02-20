# -*- coding: utf-8 -*-
"""
Gelişmiş Analytics API:
  - A/B Test analizi (2+ kampanya karşılaştırması + istatistiksel anlamlılık)
  - Cohort analizi (kampanyaları periyotlara göre gruplama)
  - Attribution modelleme (first-touch, last-touch, linear, time-decay)
  - Özel metrik hesaplayıcı (formül tabanlı, CRUD)
"""
import math
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import CustomMetric, custom_metric_to_dict
from app.services.meta_service import meta_service, MetaAPIError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics Advanced"])


# ─── Yardımcı: z-test (oran farkı) ──────────────────────────────────────────

def _z_test_two_proportions(c1: int, n1: int, c2: int, n2: int) -> dict:
    """
    İki oran arasındaki fark için z-testi.
    c = dönüşüm sayısı, n = toplam gösterim/tıklama
    """
    if n1 == 0 or n2 == 0:
        return {"z_score": 0.0, "p_value": 1.0, "significant": False, "confidence": 0.0}

    p1 = c1 / n1
    p2 = c2 / n2
    p_pool = (c1 + c2) / (n1 + n2)

    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))
    if se == 0:
        return {"z_score": 0.0, "p_value": 1.0, "significant": False, "confidence": 0.0}

    z = abs((p1 - p2) / se)

    # Normal dağılım CDF yaklaşımı (erf kullanarak)
    def norm_cdf(x: float) -> float:
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    p_value = 2 * (1 - norm_cdf(z))  # iki kuyruklu
    confidence = (1 - p_value) * 100

    return {
        "z_score": round(z, 4),
        "p_value": round(p_value, 4),
        "significant": p_value < 0.05,
        "confidence": round(confidence, 1),
        "winner": "A" if p1 > p2 else "B",
    }


# ─── A/B Test ─────────────────────────────────────────────────────────────────

class ABTestRequest(BaseModel):
    campaign_ids: List[str] = Field(..., min_length=2, max_length=8)
    metric: str = Field(
        default="ctr",
        description="Karşılaştırma metriği: ctr, roas, cpc, cpm, spend, impressions, clicks, conversions",
    )
    days: int = Field(default=30, ge=7, le=365)
    ad_account_id: Optional[str] = None


@router.post("/ab-test")
async def run_ab_test(body: ABTestRequest):
    """
    2-8 kampanyayı A/B test formatında karşılaştırır.
    İstatistiksel anlamlılık (z-test, %95 güven aralığı) hesaplar.
    """
    try:
        all_campaigns = await meta_service.get_campaigns(body.days, account_id=body.ad_account_id)
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e))

    camp_map = {c["id"]: c for c in all_campaigns}
    selected = []
    for cid in body.campaign_ids:
        c = camp_map.get(cid)
        if not c:
            raise HTTPException(status_code=404, detail=f"Kampanya bulunamadı: {cid}")
        selected.append(c)

    # Metrik değerlerini çıkar
    variants = []
    for i, c in enumerate(selected):
        val = c.get(body.metric, 0)
        variants.append({
            "id": c["id"],
            "name": c["name"],
            "status": c.get("status", ""),
            "label": chr(65 + i),  # A, B, C...
            "value": round(float(val or 0), 4),
            "spend": c.get("spend", 0),
            "impressions": c.get("impressions", 0),
            "clicks": c.get("clicks", 0),
            "conversions": c.get("conversions", 0),
            "ctr": c.get("ctr", 0),
            "roas": c.get("roas", 0),
            "cpc": c.get("cpc", 0),
            "cpm": c.get("cpm", 0),
        })

    # En iyi varyantı bul
    best = max(variants, key=lambda v: (
        v["value"] if body.metric not in ("cpc", "cpm", "spend") else -v["value"]
    ))

    # Pairwise karşılaştırma (A vs B, A vs C, ...)
    comparisons = []
    if len(variants) >= 2:
        a = variants[0]
        for b in variants[1:]:
            # CTR için z-test
            stat = _z_test_two_proportions(
                c1=int(a["clicks"]),
                n1=max(int(a["impressions"]), 1),
                c2=int(b["clicks"]),
                n2=max(int(b["impressions"]), 1),
            )
            lift = 0.0
            if b["value"] and a["value"]:
                lift = ((b["value"] - a["value"]) / a["value"]) * 100

            comparisons.append({
                "variant_a": a["label"],
                "variant_b": b["label"],
                "metric": body.metric,
                "value_a": a["value"],
                "value_b": b["value"],
                "lift_pct": round(lift, 2),
                **stat,
            })

    return {
        "metric": body.metric,
        "days": body.days,
        "variants": variants,
        "best_variant": best,
        "comparisons": comparisons,
    }


# ─── Cohort Analizi ──────────────────────────────────────────────────────────

@router.get("/cohort")
async def cohort_analysis(
    days: int = Query(90, ge=30, le=365),
    cohort_by: str = Query("week", description="week veya month"),
    metric: str = Query("spend"),
    ad_account_id: Optional[str] = Query(None),
):
    """
    Günlük verileri haftalık/aylık cohort'lara gruplar.
    Her cohort için belirtilen metriğin toplamını/ortalamasını döner.
    """
    try:
        daily_data = await meta_service.get_daily_breakdown(days, account_id=ad_account_id)
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if not daily_data:
        return {"cohorts": [], "metric": metric, "cohort_by": cohort_by}

    cohorts: Dict[str, Dict[str, Any]] = {}

    for row in daily_data:
        date_str = row.get("date_start", "")
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            continue

        if cohort_by == "week":
            iso = dt.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
        else:
            key = f"{dt.year}-{dt.month:02d}"

        val = float(row.get(metric, 0) or 0)
        if key not in cohorts:
            cohorts[key] = {"label": key, "total": 0.0, "count": 0, "days": []}
        cohorts[key]["total"] += val
        cohorts[key]["count"] += 1
        cohorts[key]["days"].append({"date": date_str, "value": val})

    result = []
    for key in sorted(cohorts.keys()):
        c = cohorts[key]
        result.append({
            "label": c["label"],
            "total": round(c["total"], 2),
            "average": round(c["total"] / c["count"], 4) if c["count"] else 0,
            "days": c["days"],
        })

    return {"cohorts": result, "metric": metric, "cohort_by": cohort_by}


# ─── Attribution Modelleme ────────────────────────────────────────────────────

class AttributionRequest(BaseModel):
    days: int = Field(default=30, ge=7, le=365)
    model: str = Field(
        default="linear",
        description="first_touch, last_touch, linear, time_decay, position_based",
    )
    ad_account_id: Optional[str] = None


@router.post("/attribution")
async def attribution_model(body: AttributionRequest):
    """
    Kampanyalara conversion değeri atar.
    Model: first_touch | last_touch | linear | time_decay | position_based
    """
    try:
        campaigns = await meta_service.get_campaigns(body.days, account_id=body.ad_account_id)
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if not campaigns:
        return {"model": body.model, "results": [], "total_value": 0}

    # Kampanyaları harcama sırasına göre sırala (proxy: "touchpoint" sırası)
    sorted_camps = sorted(campaigns, key=lambda c: float(c.get("spend", 0) or 0), reverse=True)
    n = len(sorted_camps)

    if n == 0:
        return {"model": body.model, "results": [], "total_value": 0}

    total_conv_value = sum(float(c.get("conversion_value", 0) or 0) for c in sorted_camps)

    def _assign_weights(model: str, count: int) -> list[float]:
        if model == "first_touch":
            return [1.0] + [0.0] * (count - 1)
        if model == "last_touch":
            return [0.0] * (count - 1) + [1.0]
        if model == "linear":
            return [1.0 / count] * count
        if model == "time_decay":
            # Her geri adımda %50 azalır
            raw = [0.5 ** i for i in range(count - 1, -1, -1)]
            total = sum(raw)
            return [r / total for r in raw]
        if model == "position_based":
            # 40% first, 40% last, 20% ortasına
            if count == 1:
                return [1.0]
            if count == 2:
                return [0.5, 0.5]
            mid = [0.2 / (count - 2)] * (count - 2)
            return [0.4] + mid + [0.4]
        return [1.0 / count] * count

    weights = _assign_weights(body.model, n)

    results = []
    for i, camp in enumerate(sorted_camps):
        weight = weights[i]
        attributed_value = total_conv_value * weight
        own_value = float(camp.get("conversion_value", 0) or 0)

        results.append({
            "campaign_id": camp["id"],
            "campaign_name": camp["name"],
            "spend": camp.get("spend", 0),
            "own_conversion_value": round(own_value, 2),
            "attributed_value": round(attributed_value, 2),
            "weight": round(weight, 4),
            "weight_pct": round(weight * 100, 1),
            "roas_attributed": round(attributed_value / float(camp.get("spend", 1) or 1), 3),
        })

    return {
        "model": body.model,
        "days": body.days,
        "total_conversion_value": round(total_conv_value, 2),
        "results": results,
    }


# ─── Özel Metrik CRUD ─────────────────────────────────────────────────────────

class CustomMetricCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    formula: str = Field(
        ..., min_length=1,
        description="Python-tarzı formül: spend / clicks * 1000 (cpm), (conversions / clicks) * 100, vb.",
    )
    description: Optional[str] = Field(None, max_length=500)
    format: str = Field(default="number", description="number, percent, currency")
    unit: Optional[str] = Field(None, description="Birim: %, ₺, x, vb.")


class CustomMetricUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    formula: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    format: Optional[str] = None
    unit: Optional[str] = None


@router.get("/custom-metrics")
async def list_custom_metrics(session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(CustomMetric).order_by(desc(CustomMetric.created_at))
    )
    rows = result.scalars().all()
    return {"data": [custom_metric_to_dict(r) for r in rows], "count": len(rows)}


@router.post("/custom-metrics")
async def create_custom_metric(
    body: CustomMetricCreate,
    session: AsyncSession = Depends(get_session),
):
    metric = CustomMetric(
        id=str(uuid4()),
        name=body.name,
        formula=body.formula,
        description=body.description,
        format=body.format,
        unit=body.unit,
    )
    session.add(metric)
    await session.commit()
    return {"success": True, "data": custom_metric_to_dict(metric)}


@router.put("/custom-metrics/{metric_id}")
async def update_custom_metric(
    metric_id: str,
    body: CustomMetricUpdate,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(CustomMetric).where(CustomMetric.id == metric_id)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="Metrik bulunamadı.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(metric, field, value)
    await session.commit()
    return {"success": True, "data": custom_metric_to_dict(metric)}


@router.delete("/custom-metrics/{metric_id}")
async def delete_custom_metric(
    metric_id: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(CustomMetric).where(CustomMetric.id == metric_id)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="Metrik bulunamadı.")
    await session.delete(metric)
    await session.commit()
    return {"success": True, "message": "Metrik silindi."}


@router.post("/custom-metrics/{metric_id}/calculate")
async def calculate_custom_metric(
    metric_id: str,
    session: AsyncSession = Depends(get_session),
    days: int = Query(30, ge=7, le=365),
    ad_account_id: Optional[str] = Query(None),
):
    """
    Kayıtlı formülü gerçek kampanya verisine uygular.
    Formül içinde kullanılabilecek değişkenler:
    spend, impressions, clicks, ctr, cpc, cpm, roas, conversions, conversion_value, reach, frequency
    """
    result = await session.execute(
        select(CustomMetric).where(CustomMetric.id == metric_id)
    )
    metric = result.scalar_one_or_none()
    if not metric:
        raise HTTPException(status_code=404, detail="Metrik bulunamadı.")

    try:
        campaigns = await meta_service.get_campaigns(days, account_id=ad_account_id)
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e))

    SAFE_BUILTINS: dict = {}
    SAFE_NAMES = {"__builtins__": SAFE_BUILTINS, "round": round, "abs": abs, "max": max, "min": min}

    results = []
    for c in campaigns:
        ns = {
            **SAFE_NAMES,
            "spend": float(c.get("spend", 0) or 0),
            "impressions": float(c.get("impressions", 0) or 0),
            "clicks": float(c.get("clicks", 0) or 0),
            "ctr": float(c.get("ctr", 0) or 0),
            "cpc": float(c.get("cpc", 0) or 0),
            "cpm": float(c.get("cpm", 0) or 0),
            "roas": float(c.get("roas", 0) or 0),
            "conversions": float(c.get("conversions", 0) or 0),
            "conversion_value": float(c.get("conversion_value", 0) or 0),
            "reach": float(c.get("reach", 0) or 0),
            "frequency": float(c.get("frequency", 0) or 0),
        }
        try:
            val = eval(metric.formula, {"__builtins__": {}}, ns)  # noqa: S307
            val = round(float(val), 4)
        except ZeroDivisionError:
            val = None
        except Exception as exc:
            val = None
            logger.warning("Formül hatası kampanya %s: %s", c["id"], exc)

        results.append({
            "campaign_id": c["id"],
            "campaign_name": c["name"],
            "value": val,
        })

    return {
        "metric": custom_metric_to_dict(metric),
        "days": days,
        "results": results,
    }
