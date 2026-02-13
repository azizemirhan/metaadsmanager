import asyncio
import logging
from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.database import get_db_session_optional
from app.services.meta_service import meta_service, MetaAPIError
from app.services.ai_service import analyze_campaigns, analyze_single_campaign, analyze_report_data
from app.report_templates import REPORT_TEMPLATES, get_report_data_for_template, get_template_csv_columns
from app.saved_reports import get_saved_report_by_id_optional

router = APIRouter()


class AnalyzeReportBody(BaseModel):
    report_id: str


def _handle_meta_error(e: Exception):
    if isinstance(e, MetaAPIError):
        raise HTTPException(status_code=503, detail=e.args[0] if e.args else "Meta API hatası.")
    raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast")
async def get_forecast(
    days: int = Query(30, ge=7, le=90),
    ad_account_id: Optional[str] = Query(None),
):
    """Hesap bazlı tahmini harcama: son günlük veriye göre basit trend (günlük ortalama * kalan gün)."""
    try:
        daily = await meta_service.get_daily_breakdown(days, account_id=ad_account_id)
        if not daily:
            return {
                "forecast_total_spend": 0,
                "average_daily_spend": 0,
                "days_analyzed": 0,
                "forecast_days": days,
                "message": "Yeterli günlük veri yok.",
            }
        total_spend = sum(float(d.get("spend", 0) or 0) for d in daily)
        days_analyzed = len(daily)
        avg_daily = total_spend / days_analyzed if days_analyzed else 0
        forecast_total = avg_daily * days
        return {
            "forecast_total_spend": round(forecast_total, 2),
            "average_daily_spend": round(avg_daily, 2),
            "total_spend_so_far": round(total_spend, 2),
            "days_analyzed": days_analyzed,
            "forecast_days": days,
        }
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/anomalies")
@router.get("/alerts")
async def get_anomalies(
    days: int = Query(14, ge=7, le=90),
    ad_account_id: Optional[str] = Query(None),
):
    """Harcama / CTR / ROAS sapması veya düşük performans uyarıları (kampanya bazlı)."""
    try:
        campaigns = await meta_service.get_campaigns(days, account_id=ad_account_id)
        if not campaigns:
            return {"data": [], "count": 0}
        daily = await meta_service.get_daily_breakdown(days, account_id=ad_account_id)
        # Günlük harcama ortalaması (sapma için)
        avg_daily_spend = 0
        if daily:
            total = sum(float(d.get("spend", 0) or 0) for d in daily)
            avg_daily_spend = total / len(daily)
        # Kampanya bazlı uyarılar
        alerts = []
        for c in campaigns:
            spend = float(c.get("spend", 0) or 0)
            ctr = float(c.get("ctr", 0) or 0)
            roas = float(c.get("roas", 0) or 0)
            name = c.get("name", "") or c.get("id", "")
            cid = c.get("id", "")
            # Düşük CTR
            if ctr > 0 and ctr < 0.5:
                alerts.append({
                    "type": "low_ctr",
                    "campaign_id": cid,
                    "campaign_name": name,
                    "metric": "ctr",
                    "value": ctr,
                    "message": f"CTR düşük (%{ctr:.2f}). Kreatif veya hedef kitle gözden geçirilmeli.",
                    "action": "review_creative",
                })
            # Düşük ROAS (harcama varsa)
            if spend > 0 and roas < 1 and roas >= 0:
                alerts.append({
                    "type": "low_roas",
                    "campaign_id": cid,
                    "campaign_name": name,
                    "metric": "roas",
                    "value": roas,
                    "message": f"ROAS düşük ({roas:.2f}x). Bütçe veya teklif stratejisi önerilir.",
                    "action": "reduce_budget_or_pause",
                })
            # Yüksek harcama (günlük ortalamanın 2 katından fazla kampanya harcaması - günlük değil toplam)
            if avg_daily_spend > 0 and spend > avg_daily_spend * 3:
                alerts.append({
                    "type": "high_spend",
                    "campaign_id": cid,
                    "campaign_name": name,
                    "metric": "spend",
                    "value": spend,
                    "message": f"Harcama yüksek ({spend:.2f}). Bütçe kontrolü önerilir.",
                    "action": "review_budget",
                })
        return {"data": alerts, "count": len(alerts)}
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        _handle_meta_error(e)


@router.get("/analyze")
async def analyze_all_campaigns(days: int = Query(30, ge=7, le=365)):
    """Tüm kampanyaları AI ile analiz et"""
    try:
        campaigns = await meta_service.get_campaigns(days)
        if not campaigns:
            raise HTTPException(status_code=404, detail="Kampanya bulunamadı")
        
        analysis = await analyze_campaigns(campaigns)
        return {
            "analysis": analysis,
            "campaign_count": len(campaigns),
            "period_days": days
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analyze/{campaign_id}")
async def analyze_campaign(campaign_id: str, days: int = Query(30, ge=7, le=365)):
    """Tek bir kampanyayı derinlemesine analiz et"""
    try:
        campaigns = await meta_service.get_campaigns(days)
        campaign = next((c for c in campaigns if c.get("id") == campaign_id), None)
        
        if not campaign:
            raise HTTPException(status_code=404, detail="Kampanya bulunamadı")
        
        analysis = await analyze_single_campaign(campaign)
        return {"campaign": campaign, "analysis": analysis}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _get_report_template_ids(saved: dict):
    """Kayıtlı rapor kaydından şablon id listesi (eski template_id veya template_ids)."""
    if saved.get("template_ids"):
        return saved["template_ids"]
    if saved.get("template_id"):
        return [saved["template_id"]]
    return []


@router.post("/analyze-report")
async def analyze_saved_report(
    body: AnalyzeReportBody,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Kayıtlı bir hazır raporun verisini AI ile analiz ettirir. Çoklu şablonda her biri ayrı analiz edilip birleştirilir."""
    saved = await get_saved_report_by_id_optional(session, body.report_id)
    if not saved:
        raise HTTPException(status_code=404, detail="Kayıtlı rapor bulunamadı.")
    tids = _get_report_template_ids(saved)
    if not tids:
        raise HTTPException(status_code=400, detail="Raporda şablon bilgisi yok.")
    try:
        days = saved.get("days", 30)
        account_id = saved.get("ad_account_id")
        report_name = saved.get("name", "Rapor")
        parts = []
        total_rows = 0
        template_titles = []
        for i, tid in enumerate(tids):
            if i > 0:
                await asyncio.sleep(2)
            template = next((t for t in REPORT_TEMPLATES if t["id"] == tid), {})
            title = template.get("title", tid)
            template_titles.append(title)
            try:
                rows = await get_report_data_for_template(tid, days, account_id, meta_service)
            except MetaAPIError as e:
                err_msg = str(e.args[0]) if e.args else "Meta API hatası"
                if "limit" in err_msg.lower() or "17" in err_msg:
                    await asyncio.sleep(60)
                    try:
                        rows = await get_report_data_for_template(tid, days, account_id, meta_service)
                    except MetaAPIError:
                        parts.append(f"## {title}\n\nMeta API istek limiti. Birkaç dakika sonra tekrar deneyin.")
                        continue
                else:
                    parts.append(f"## {title}\n\nMeta API hatası: {err_msg}. Birkaç dakika sonra tekrar deneyin.")
                    continue
            columns = get_template_csv_columns(tid)
            if not rows:
                parts.append(f"## {title}\n\nBu şablon için veri bulunamadı (Meta API boş döndü).")
                continue
            total_rows += len(rows)
            try:
                analysis = await analyze_report_data(report_name, title, rows, columns or [])
                parts.append(f"## {title}\n\n{analysis}")
            except Exception as ae:
                parts.append(f"## {title}\n\nAnaliz atlandı: {ae!s}")
        combined = "\n\n---\n\n".join(parts)
        return {
            "report_id": body.report_id,
            "report_name": report_name,
            "template_title": template_titles[0] if len(template_titles) == 1 else None,
            "template_titles": template_titles,
            "analysis": combined,
            "row_count": total_rows,
        }
    except HTTPException:
        raise
    except MetaAPIError as e:
        _handle_meta_error(e)
    except Exception as e:
        logger.exception("analyze-report failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
