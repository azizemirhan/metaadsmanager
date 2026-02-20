# -*- coding: utf-8 -*-
"""
Campaign Otomasyon Servisi.
Aktif kuralları kampanya metrikleriyle karşılaştırır ve
pause/resume/budget/notify aksiyonlarını gerçekleştirir.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CampaignAutomationRule,
    CampaignAutomationLog,
    automation_rule_to_dict,
)
from app.services.meta_service import meta_service, MetaAPIError

logger = logging.getLogger(__name__)

# Desteklenen aksiyonlar
VALID_ACTIONS = ("pause", "resume", "notify", "budget_decrease", "budget_increase")
VALID_METRICS = ("ctr", "roas", "spend", "cpc", "cpm", "impressions", "clicks", "frequency")
VALID_CONDITIONS = ("lt", "gt")


def _condition_met(condition: str, actual: float, threshold: float) -> bool:
    if condition == "lt":
        return actual < threshold
    if condition == "gt":
        return actual > threshold
    return False


async def run_automation_rule(
    rule: CampaignAutomationRule,
    session: AsyncSession,
    dry_run: bool = False,
) -> list[dict]:
    """
    Tek bir otomasyon kuralını çalıştırır.

    dry_run=True ise Meta API'ye yazma işlemi yapmaz,
    sadece neyin tetikleneceğini döner.
    """
    # Cooldown kontrolü
    if rule.last_triggered and rule.cooldown_minutes:
        cooldown_end = rule.last_triggered + timedelta(minutes=rule.cooldown_minutes)
        if datetime.now(timezone.utc) < cooldown_end:
            logger.debug("Kural %s cooldown'da, atlanıyor.", rule.id)
            return []

    # Kampanya verilerini çek
    try:
        campaigns = await meta_service.get_campaigns(7, account_id=rule.ad_account_id)
    except MetaAPIError as e:
        logger.warning("Kural %s için Meta API hatası: %s", rule.id, e)
        return []

    # Belirli kampanyalar filtresi
    if rule.campaign_ids:
        campaigns = [c for c in campaigns if c.get("id") in rule.campaign_ids]

    results = []

    for campaign in campaigns:
        campaign_id = campaign.get("id", "")
        campaign_name = campaign.get("name", "")
        metric_value = campaign.get(rule.metric)

        if metric_value is None:
            continue

        metric_value = float(metric_value)

        if not _condition_met(rule.condition, metric_value, rule.threshold):
            continue

        # Aksiyon uygula
        success = True
        error = None
        message = (
            f"[{rule.action.upper()}] Kampanya '{campaign_name}' — "
            f"{rule.metric.upper()} {metric_value:.3f} "
            f"{'<' if rule.condition == 'lt' else '>'} eşik {rule.threshold}"
        )

        if not dry_run:
            try:
                if rule.action == "pause":
                    await meta_service.update_campaign_status(campaign_id, "PAUSED")
                    message += " → DURAKLATILDI"

                elif rule.action == "resume":
                    await meta_service.update_campaign_status(campaign_id, "ACTIVE")
                    message += " → YENIDEN BAŞLATILDI"

                elif rule.action in ("budget_decrease", "budget_increase"):
                    pct = rule.action_value or 20.0
                    adsets = await meta_service.get_ad_sets(campaign_id, 7, account_id=rule.ad_account_id)
                    for adset in adsets:
                        adset_id = adset.get("id")
                        current_budget = float(adset.get("daily_budget", 0) or adset.get("lifetime_budget", 0) or 0)
                        if current_budget > 0 and adset_id:
                            factor = (1 - pct / 100) if rule.action == "budget_decrease" else (1 + pct / 100)
                            new_budget = max(int(current_budget * factor), 100)  # min 100 kuruş
                            await meta_service._post(
                                f"{adset_id}",
                                {"daily_budget": new_budget},
                            )
                    action_label = "DÜŞÜRÜLDÜ" if rule.action == "budget_decrease" else "ARTTIRILDI"
                    message += f" → BÜTÇE %{pct:.0f} {action_label}"

                elif rule.action == "notify":
                    message += " → BİLDİRİM GÖNDERİLDİ"

            except Exception as exc:
                success = False
                error = str(exc)
                logger.exception("Otomasyon aksiyonu başarısız: %s", exc)

        # Log kaydı oluştur
        log = CampaignAutomationLog(
            id=str(uuid4()),
            rule_id=rule.id,
            campaign_id=campaign_id,
            campaign_name=campaign_name,
            action_taken=rule.action,
            metric=rule.metric,
            threshold=rule.threshold,
            actual_value=metric_value,
            success=success,
            message=message,
            error=error,
        )
        session.add(log)

        results.append({
            "campaign_id": campaign_id,
            "campaign_name": campaign_name,
            "metric": rule.metric,
            "actual_value": metric_value,
            "threshold": rule.threshold,
            "action": rule.action,
            "success": success,
            "message": message,
            "error": error,
        })

    # Kural tetiklendiyse güncelle
    if results and not dry_run:
        rule.last_triggered = datetime.now(timezone.utc)
        rule.trigger_count = (rule.trigger_count or 0) + len(results)
        rule.updated_at = datetime.now(timezone.utc)

    await session.commit()
    return results


async def run_all_active_rules(
    session: AsyncSession,
    ad_account_id: Optional[str] = None,
    dry_run: bool = False,
) -> dict:
    """Tüm aktif otomasyon kurallarını çalıştırır."""
    stmt = select(CampaignAutomationRule).where(CampaignAutomationRule.is_active == True)
    if ad_account_id:
        stmt = stmt.where(CampaignAutomationRule.ad_account_id == ad_account_id)

    result = await session.execute(stmt)
    rules = result.scalars().all()

    total_triggered = 0
    all_results = []

    for rule in rules:
        rule_results = await run_automation_rule(rule, session, dry_run=dry_run)
        total_triggered += len(rule_results)
        all_results.extend(rule_results)

    return {
        "rules_checked": len(rules),
        "total_triggered": total_triggered,
        "dry_run": dry_run,
        "results": all_results,
    }
