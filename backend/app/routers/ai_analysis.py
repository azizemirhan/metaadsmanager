import asyncio
import json
import logging
from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.database import get_db_session_optional, get_session
from app.services.meta_service import meta_service, MetaAPIError
from app.services.ai_service import analyze_campaigns, analyze_single_campaign, analyze_report_data, generate_ad_summary_from_reports
from app.report_templates import REPORT_TEMPLATES, get_report_data_for_template, get_template_csv_columns
from app.saved_reports import get_saved_report_by_id_optional
from app.models import JobStatus
from app.routers.targeting import get_targeting_options_data
from app.services import strategy_service
from app import config

router = APIRouter()


class AnalyzeReportBody(BaseModel):
    report_id: str


class GenerateAdSummaryBody(BaseModel):
    user_context: str
    user_context_image_base64: Optional[str] = None
    job_ids: list[str] = []


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
async def analyze_all_campaigns(
    days: int = Query(30, ge=7, le=365),
    ad_account_id: Optional[str] = Query(None),
):
    """Tüm kampanyaları AI ile analiz et"""
    try:
        campaigns = await meta_service.get_campaigns(days, account_id=ad_account_id)
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
async def analyze_campaign(
    campaign_id: str,
    days: int = Query(30, ge=7, le=365),
    ad_account_id: Optional[str] = Query(None),
):
    """Tek bir kampanyayı derinlemesine analiz et"""
    try:
        campaigns = await meta_service.get_campaigns(days, account_id=ad_account_id)
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


@router.post("/generate-ad-summary")
async def generate_ad_summary(
    body: GenerateAdSummaryBody,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Rapor analizlerine ve kullanıcı bağlamına göre reklam özeti oluşturur."""
    if not body.user_context.strip():
        raise HTTPException(status_code=400, detail="Reklam çıkacağınız ürün/hizmet hakkında metin girin.")
    analysis_parts = []
    if body.job_ids and session:
        for job_id in body.job_ids[:10]:
            result = await session.execute(
                select(JobStatus).where(JobStatus.id == job_id).where(JobStatus.job_type == "analyze").where(JobStatus.status == "completed")
            )
            row = result.scalar_one_or_none()
            if row and row.result_text:
                analysis_parts.append(f"--- Rapor ({job_id}) ---\n{row.result_text}")
    analysis_texts = "\n\n".join(analysis_parts) if analysis_parts else ""
    targeting_options = get_targeting_options_data()
    try:
        data = await generate_ad_summary_from_reports(
            user_context=body.user_context.strip(),
            analysis_texts=analysis_texts,
            image_base64=body.user_context_image_base64 if body.user_context_image_base64 else None,
            targeting_options=targeting_options,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"form": data}


# ===== STRATEJİST ASİSTANI ENDPOINT'LERİ =====

class StrategicAdSummaryBody(BaseModel):
    user_context: str
    behavior_mode: str = "RISK_MINIMIZER"  # RISK_MINIMIZER, CREATIVE_LAB, BUDGET_GUARD, FAST_CONVERSION, SCALE_READY
    raw_data_csv: Optional[str] = None  # CSV formatında ham veri
    raw_data_json: Optional[str] = None  # JSON formatında ham veri
    job_ids: list[str] = []  # Geçmiş analiz job ID'leri
    user_context_image_base64: Optional[str] = None


@router.get("/behavior-modes")
async def get_behavior_modes():
    """Tüm davranış modellerini listeler."""
    return {"modes": strategy_service.get_all_behavior_modes()}


@router.post("/generate-strategic-ad-summary")
async def generate_strategic_ad_summary(
    body: StrategicAdSummaryBody,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """
    Stratejist Asistanı: Davranış modeli, ham veri ve geçmiş analizleri birleştirerek
    hata payı minimize edilmiş, yüksek dönüşüm odaklı reklam planı oluşturur.
    """
    if not body.user_context.strip():
        raise HTTPException(status_code=400, detail="Reklam çıkacağınız ürün/hizmet hakkında metin girin.")
    
    # Davranış modu doğrulama
    if body.behavior_mode not in strategy_service.BEHAVIOR_MODES:
        raise HTTPException(
            status_code=400, 
            detail=f"Geçersiz davranış modu. Geçerli değerler: {list(strategy_service.BEHAVIOR_MODES.keys())}"
        )
    
    # 1. Ham veri analizi
    performance_analysis = {"best_ctr": None, "lowest_cpc": None, "best_platforms": [], "best_ages": [], "worst_platforms": [], "worst_ages": []}
    
    if body.raw_data_csv:
        raw_rows = strategy_service.parse_csv_data(body.raw_data_csv)
        performance_analysis = strategy_service.analyze_performance_data(raw_rows)
    elif body.raw_data_json:
        raw_rows = strategy_service.parse_json_data(body.raw_data_json)
        performance_analysis = strategy_service.analyze_performance_data(raw_rows)
    
    # 2. Geçmiş analiz derslerini çıkar
    past_lessons = []
    if body.job_ids and session:
        for job_id in body.job_ids[:10]:
            result = await session.execute(
                select(JobStatus).where(JobStatus.id == job_id).where(JobStatus.job_type == "analyze").where(JobStatus.status == "completed")
            )
            row = result.scalar_one_or_none()
            if row and row.result_text:
                lessons = strategy_service.extract_lessons_from_analysis(row.result_text)
                past_lessons.extend(lessons)
    
    # 3. Davranış modeline göre prompt oluştur
    mode_rules = strategy_service.BEHAVIOR_MODES[body.behavior_mode]
    strategic_prompt = strategy_service.generate_behavior_mode_prompt(
        behavior_mode=body.behavior_mode,
        performance_analysis=performance_analysis,
        past_lessons=past_lessons,
        user_context=body.user_context.strip()
    )
    
    # 4. AI ile stratejik özet oluştur
    targeting_options = get_targeting_options_data()
    try:
        data = await generate_strategic_ad_summary_with_ai(
            strategic_prompt=strategic_prompt,
            behavior_mode=body.behavior_mode,
            mode_rules=mode_rules,
            performance_analysis=performance_analysis,
            image_base64=body.user_context_image_base64,
            targeting_options=targeting_options,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    return {
        "form": data,
        "strategy": {
            "behavior_mode": body.behavior_mode,
            "mode_name": mode_rules.name_tr,
            "risk_level": mode_rules.risk_level,
            "budget_multiplier": mode_rules.budget_multiplier,
            "applied_rules": [
                f"Bütçe çarpanı: {mode_rules.budget_multiplier}x",
                f"Kreatif varyasyon: {mode_rules.creative_variations}",
                f"FOMO aktif: {'Evet' if mode_rules.enable_fomo else 'Hayır'}",
                f"Advantage+: {'Evet' if mode_rules.enable_advantage_plus else 'Hayır'}",
                f"Negatif liste: {'Evet' if mode_rules.exclude_zero_result_demo else 'Hayır'}",
            ],
            "performance_insights": {
                "best_platforms": performance_analysis.get("best_platforms", []),
                "best_ages": performance_analysis.get("best_ages", []),
                "excluded_platforms": performance_analysis.get("worst_platforms", []) if mode_rules.exclude_zero_result_demo else [],
                "excluded_ages": performance_analysis.get("worst_ages", []) if mode_rules.exclude_zero_result_demo else [],
            },
            "lessons_applied": len(past_lessons)
        }
    }


async def generate_strategic_ad_summary_with_ai(
    strategic_prompt: str,
    behavior_mode: str,
    mode_rules: strategy_service.BehaviorModeRules,
    performance_analysis: dict,
    image_base64: Optional[str],
    targeting_options: dict
) -> dict:
    """AI kullanarak stratejik reklam özeti oluşturur."""
    
    from app.services.ai_service import _ai_provider, _get_claude_model, _get_gemini_model, AD_SUMMARY_JSON_SCHEMA
    
    targeting_block = ""
    if targeting_options:
        targeting_block = f"""
## MEVCUT HEDEF KITLE SEÇENEKLERİ (ZORUNLU - SADECE BUNLARDAN SEÇ):
{_format_targeting_for_prompt(targeting_options)}
"""
    
    full_prompt = f"""{strategic_prompt}

{targeting_block}

## ÇIKTI ŞEMASI (bu formatta JSON döndür):
{AD_SUMMARY_JSON_SCHEMA}

## EK KURALLAR:
- dailyBudget: kuruş cinsinden, davranış modelinin bütçe çarpanını uygula
- selectedDemographics, selectedInterests, selectedBehaviors: SADECE yukarıdaki listelerden, etiketleri BİREBİR kopyala
- platforms: {mode_rules.focus_platforms}
- abTestEnabled: {'true' if mode_rules.creative_variations > 1 else 'false'}
- Sadece geçerli JSON döndür, başka metin ekleme
"""
    
    provider = _ai_provider()
    anthropic_key = config.get_setting("ANTHROPIC_API_KEY") or ""
    gemini_key = config.get_setting("GEMINI_API_KEY") or ""
    
    # Claude (resim destekli)
    if anthropic_key and provider != "gemini":
        try:
            import anthropic
            import base64
            client = anthropic.Anthropic(api_key=anthropic_key)
            content = [{"type": "text", "text": full_prompt}]
            if image_base64:
                try:
                    content.insert(0, {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/jpeg", "data": image_base64},
                    })
                except Exception:
                    pass
            message = client.messages.create(
                model=_get_claude_model(),
                max_tokens=4000,
                system="Sen Meta Ads strateji uzmanısın. Davranış modellerine göre optimize edilmiş reklam planları oluşturursun. Sadece geçerli JSON döndür.",
                messages=[{"role": "user", "content": content}],
            )
            if message.content and len(message.content) > 0 and hasattr(message.content[0], "text"):
                text = message.content[0].text.strip()
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                return json.loads(text)
        except Exception as e:
            if gemini_key:
                pass
            else:
                raise ValueError(f"Claude hatası: {e}") from e
    
    # Gemini (resim destekli)
    if gemini_key:
        try:
            import google.generativeai as genai
            import base64
            genai.configure(api_key=gemini_key)
            model_name = _get_gemini_model()
            model = genai.GenerativeModel(model_name)
            parts = [full_prompt]
            if image_base64:
                try:
                    import PIL.Image
                    import io
                    img_data = base64.b64decode(image_base64)
                    img = PIL.Image.open(io.BytesIO(img_data))
                    parts.insert(0, img)
                except Exception:
                    pass
            response = model.generate_content(parts)
            if response.candidates:
                part = response.candidates[0].content.parts[0] if response.candidates[0].content.parts else None
                if part and hasattr(part, "text"):
                    text = part.text.strip()
                    if "```json" in text:
                        text = text.split("```json")[1].split("```")[0].strip()
                    elif "```" in text:
                        text = text.split("```")[1].split("```")[0].strip()
                    return json.loads(text)
        except Exception as e:
            raise ValueError(f"AI hatası: {e}") from e
    
    raise ValueError("GEMINI_API_KEY veya ANTHROPIC_API_KEY tanımlı olmalı.")


def _format_targeting_for_prompt(options: dict) -> str:
    """Hedef kitle seçeneklerini prompt için metne dönüştürür."""
    parts = []
    for cat, key in [("Demografik Bilgiler", "demographics"), ("İlgi Alanları", "interests"), ("Davranışlar", "behaviors")]:
        items = options.get(key) or []
        labels = [x.get("label", "").strip() for x in items if x.get("label") and "Kullanılamıyor" not in str(x.get("size", ""))]
        if labels:
            parts.append(f"### {cat} (sadece bu etiketlerden seç, aynen kopyala):\n" + "\n".join(f"- {l}" for l in labels[:300]))
        else:
            parts.append(f"### {cat}: (boş)")
    return "\n\n".join(parts)
