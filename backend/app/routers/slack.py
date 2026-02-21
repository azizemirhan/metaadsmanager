# -*- coding: utf-8 -*-
"""Slack entegrasyonu API endpoint'leri."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.slack_service import slack_service
from app.deps import RequireAdmin

router = APIRouter()


class SlackTestRequest(BaseModel):
    message: str = "🧪 Test mesajı - Slack entegrasyonu çalışıyor!"


class SlackCampaignAlertRequest(BaseModel):
    campaign_name: str
    campaign_id: str
    alert_type: str  # "paused", "started", "low_performance", "high_roas"
    details: dict
    action_url: Optional[str] = None


@router.get("/status")
async def get_slack_status(
    current_user: RequireAdmin
):
    """Slack entegrasyon durumunu kontrol et."""
    return slack_service.test_connection()


@router.post("/test")
async def send_test_message(
    request: SlackTestRequest,
    current_user: RequireAdmin
):
    """Test mesajı gönder."""
    success = await slack_service.send_message(
        text=request.message,
        username="Meta Ads Bot",
        icon_emoji=":chart_with_upwards_trend:"
    )
    
    if success:
        return {"message": "Test mesajı Slack'e gönderildi ✅"}
    else:
        raise HTTPException(
            status_code=500,
            detail="Slack mesajı gönderilemedi. Webhook URL'sini kontrol edin."
        )


@router.post("/alert/campaign")
async def send_campaign_alert(
    request: SlackCampaignAlertRequest,
    current_user: RequireAdmin
):
    """Kampanya bildirimi gönder."""
    success = await slack_service.send_campaign_alert(
        campaign_name=request.campaign_name,
        campaign_id=request.campaign_id,
        alert_type=request.alert_type,
        details=request.details,
        action_url=request.action_url
    )
    
    if success:
        return {"message": "Bildirim Slack'e gönderildi ✅"}
    else:
        raise HTTPException(
            status_code=500,
            detail="Bildirim gönderilemedi"
        )


@router.post("/send-summary")
async def send_daily_summary(
    current_user: RequireAdmin
):
    """Manuel olarak günlük özet gönder."""
    # TODO: Gerçek verilerle değiştir
    success = await slack_service.send_daily_summary(
        total_spend=5240.50,
        total_clicks=1234,
        total_impressions=50000,
        avg_ctr=2.47,
        top_campaigns=[
            {"name": "Yaz İndirimi", "roas": 4.2, "spend": 1500},
            {"name": "Kış Koleksiyonu", "roas": 3.8, "spend": 1200},
        ],
        alerts=[
            "3 kampanya düşük performanslı",
            "Bütçe limitine yaklaşıldı"
        ]
    )
    
    if success:
        return {"message": "Günlük özet Slack'e gönderildi ✅"}
    else:
        raise HTTPException(
            status_code=500,
            detail="Özet gönderilemedi"
        )
