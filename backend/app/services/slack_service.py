# -*- coding: utf-8 -*-
"""Slack entegrasyonu - Webhook üzerinden kanala mesaj gönderme."""

import json
import logging
from typing import Optional
from datetime import datetime

import httpx
from app import config

logger = logging.getLogger(__name__)


class SlackService:
    """Slack webhook üzerinden bildirim gönderme servisi."""
    
    def __init__(self):
        self.webhook_url: Optional[str] = None
        self.enabled: bool = False
        self._load_config()
    
    def _load_config(self):
        """Ayarları yükle."""
        self.webhook_url = config.get_setting("SLACK_WEBHOOK_URL")
        self.enabled = bool(self.webhook_url and "hooks.slack.com" in self.webhook_url)
    
    async def send_message(
        self,
        text: str,
        channel: Optional[str] = None,
        username: Optional[str] = None,
        icon_emoji: Optional[str] = None
    ) -> bool:
        """Slack kanalına basit mesaj gönder."""
        if not self.enabled:
            logger.warning("Slack yapılandırılmamış. Mesaj gönderilemedi.")
            return False
        
        payload = {"text": text}
        if channel:
            payload["channel"] = channel
        if username:
            payload["username"] = username
        if icon_emoji:
            payload["icon_emoji"] = icon_emoji
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"Slack mesaj gönderme hatası: {e}")
            return False
    
    async def send_campaign_alert(
        self,
        campaign_name: str,
        campaign_id: str,
        alert_type: str,  # "paused", "started", "low_performance", "high_roas"
        details: dict,
        action_url: Optional[str] = None
    ) -> bool:
        """Kampanya durumu değişikliğinde zengin mesaj gönder."""
        
        # Emoji ve renk belirle
        emoji_map = {
            "paused": "⏸️",
            "started": "▶️",
            "low_performance": "⚠️",
            "high_roas": "🚀",
            "budget_limit": "💰",
            "completed": "✅"
        }
        color_map = {
            "paused": "#808080",
            "started": "#36a64f",
            "low_performance": "#ff0000",
            "high_roas": "#00ff00",
            "budget_limit": "#ffa500",
            "completed": "#0000ff"
        }
        
        emoji = emoji_map.get(alert_type, "📢")
        color = color_map.get(alert_type, "#808080")
        
        # Durum metni
        status_text = {
            "paused": "DURAKLATILDI",
            "started": "BAŞLATILDI",
            "low_performance": "DÜŞÜK PERFORMANS",
            "high_roas": "YÜKSEK ROAS",
            "budget_limit": "BÜTÇE LİMİTİ",
            "completed": "TAMAMLANDI"
        }.get(alert_type, "BİLDİRİM")
        
        # Mesaj bloğu oluştur
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} Kampanya {status_text}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Kampanya:*\n{campaign_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*ID:*\n`{campaign_id}`"
                    }
                ]
            },
            {
                "type": "section",
                "fields": []
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"⏰ {datetime.now().strftime('%d.%m.%Y %H:%M')}"
                    }
                ]
            }
        ]
        
        # Detayları ekle
        fields = blocks[2]["fields"]
        for key, value in details.items():
            fields.append({
                "type": "mrkdwn",
                "text": f"*{key}:*\n{value}"
            })
        
        # Action butonu ekle
        if action_url:
            blocks.append({
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Dashboard'da Görüntüle 🔗",
                            "emoji": True
                        },
                        "url": action_url,
                        "action_id": "view_dashboard"
                    }
                ]
            })
        
        payload = {
            "attachments": [
                {
                    "color": color,
                    "blocks": blocks
                }
            ]
        }
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                logger.info(f"Slack bildirimi gönderildi: {campaign_name} - {alert_type}")
                return True
        except Exception as e:
            logger.error(f"Slack bildirim hatası: {e}")
            return False
    
    async def send_daily_summary(
        self,
        total_spend: float,
        total_clicks: int,
        total_impressions: int,
        avg_ctr: float,
        top_campaigns: list,
        alerts: list
    ) -> bool:
        """Günlük özet rapor gönder."""
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📊 Meta Ads Günlük Özet - {datetime.now().strftime('%d.%m.%Y')}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*💰 Toplam Harcama:*\n₺{total_spend:,.2f}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*🖱️ Tıklama:*\n{total_clicks:,}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*👁️ Gösterim:*\n{total_impressions:,}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*📈 Ort. CTR:*\n%{avg_ctr:.2f}"
                    }
                ]
            }
        ]
        
        # En iyi kampanyalar
        if top_campaigns:
            campaign_text = "\n".join([
                f"• *{c['name']}* - ROAS: {c['roas']}x - ₺{c['spend']:,.2f}"
                for c in top_campaigns[:3]
            ])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🏆 En İyi Kampanyalar:*\n{campaign_text}"
                }
            })
        
        # Uyarılar
        if alerts:
            alert_text = "\n".join([f"⚠️ {alert}" for alert in alerts[:5]])
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*🔔 Uyarılar:*\n{alert_text}"
                }
            })
        
        payload = {"blocks": blocks}
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    self.webhook_url,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                response.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"Slack özet rapor hatası: {e}")
            return False
    
    def test_connection(self) -> dict:
        """Slack bağlantısını test et."""
        return {
            "enabled": self.enabled,
            "webhook_configured": bool(self.webhook_url),
            "message": "Slack webhook yapılandırılmış" if self.enabled else "Slack webhook URL ayarlanmamış"
        }


# Singleton instance
slack_service = SlackService()
