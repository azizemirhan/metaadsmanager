# -*- coding: utf-8 -*-
"""
Meta Marketing API Webhook Entegrasyonu

Meta, kampanya durumu, reklam seti bütçesi, reklam durumu gibi 
olayları gerçek zamanlı webhook ile bildirir.

Webhook URL: https://yourdomain.com/api/webhooks/meta
"""
import hmac
import hashlib
import json
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Request, HTTPException, Header, Query, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session_optional
from app.models import AlertRule, AlertHistory
from app.services.meta_service import meta_service
from app import config

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])
logger = logging.getLogger(__name__)


# ============ Config & Models ============

class MetaWebhookPayload(BaseModel):
    """Meta webhook payload yapısı"""
    object: str = "ads"
    entry: list = Field(default_factory=list)


class WebhookEvent(BaseModel):
    """Tek bir webhook olayı"""
    id: str  # changed_field:id formatında
    time: int
    changed_fields: list[str] = Field(default_factory=list)


class WebhookConfig(BaseModel):
    """Webhook yapılandırma durumu"""
    verify_token: Optional[str] = None
    app_secret: Optional[str] = None
    webhook_url: Optional[str] = None
    is_configured: bool = False


# ============ Constants ============

# Meta'dan gelen olay tipleri
EVENT_TYPES = {
    "campaigns": {
        "name": "Kampanya",
        "fields": ["status", "name", "objective", "daily_budget", "lifetime_budget"]
    },
    "adsets": {
        "name": "Reklam Seti",
        "fields": ["status", "name", "daily_budget", "lifetime_budget", "targeting", "bid_amount"]
    },
    "ads": {
        "name": "Reklam",
        "fields": ["status", "name", "creative", "adset_id"]
    },
}

# Alanların insan-readable isimleri
FIELD_LABELS = {
    "status": "Durum",
    "name": "İsim",
    "objective": "Hedef",
    "daily_budget": "Günlük Bütçe",
    "lifetime_budget": "Toplam Bütçe",
    "targeting": "Hedef Kitle",
    "bid_amount": "Teklif Miktarı",
    "creative": "Kreatif",
    "adset_id": "Reklam Seti ID",
}

STATUS_TRANSLATIONS = {
    "ACTIVE": "Aktif",
    "PAUSED": "Duraklatıldı",
    "ARCHIVED": "Arşivlendi",
    "DELETED": "Silindi",
    "PENDING_REVIEW": "İncelemede",
    "DISAPPROVED": "Reddedildi",
    "PREAPPROVED": "Ön Onaylı",
}


# ============ Helper Functions ============

def _get_verify_token() -> str:
    """Webhook doğrulama token'ı"""
    return config.get_setting("META_WEBHOOK_VERIFY_TOKEN") or "meta_ads_webhook_secret"


def _get_app_secret() -> Optional[str]:
    """Meta App Secret (payload imza doğrulama için)"""
    return config.get_setting("META_APP_SECRET")


def _verify_signature(payload: bytes, signature: Optional[str]) -> bool:
    """
    Meta webhook payload imzasını doğrula.
    X-Hub-Signature-256 header'ı SHA256 HMAC ile kontrol edilir.
    """
    app_secret = _get_app_secret()
    if not app_secret:
        logger.warning("META_APP_SECRET tanımlı değil, imza doğrulama atlanıyor")
        return True  # Geliştirme ortamında atla
    
    if not signature:
        return False
    
    # Format: sha256=<signature>
    expected_signature = hmac.new(
        app_secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    expected = f"sha256={expected_signature}"
    return hmac.compare_digest(expected, signature)


def _format_change_message(object_type: str, object_id: str, changed_fields: list) -> str:
    """Değişiklik bildirimi için insan-readable mesaj oluştur"""
    type_info = EVENT_TYPES.get(object_type, {"name": object_type})
    type_name = type_info["name"]
    
    field_names = []
    for field in changed_fields:
        label = FIELD_LABELS.get(field, field)
        field_names.append(label)
    
    fields_str = ", ".join(field_names) if field_names else "Alanlar"
    
    return f"🔄 {type_name} güncellendi (ID: {object_id}): {fields_str}"


async def _send_webhook_alert(
    session: AsyncSession,
    object_type: str,
    object_id: str,
    changed_fields: list,
    event_data: dict
):
    """
    Önemli webhook olayları için uyarı gönder.
    Örneğin: Kampanya duraklatıldığında, bütçe bittiğinde
    """
    # Sadece kritik alanlar için uyarı gönder
    critical_fields = ["status", "daily_budget", "lifetime_budget"]
    if not any(f in changed_fields for f in critical_fields):
        return
    
    # Durum değişikliği kontrolü
    if "status" in changed_fields:
        new_status = event_data.get("status", "Bilinmiyor")
        status_tr = STATUS_TRANSLATIONS.get(new_status, new_status)
        
        # Kampanya duraklatıldıysa özel mesaj
        if new_status == "PAUSED":
            message = f"⏸️ Kampanya duraklatıldı: {object_id}"
        elif new_status == "ACTIVE":
            message = f"▶️ Kampanya aktif edildi: {object_id}"
        elif new_status == "ARCHIVED":
            message = f"📁 Kampanya arşivlendi: {object_id}"
        else:
            message = f"🔄 Kampanya durumu değişti: {status_tr} ({object_id})"
        
        # Burada email/whatsapp gönderimi yapılabilir
        # Şimdilik sadece logla
        logger.info(f"[Webhook Alert] {message}")


# ============ Webhook Endpoint'leri ============

@router.get("/meta")
async def meta_webhook_verify(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
):
    """
    Meta webhook doğrulama endpoint'i.
    Meta, webhook kaydederken bu endpoint'i çağırarak doğrulama yapar.
    
    Örnek istek:
    GET /api/webhooks/meta?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=123
    
    Returns:
        hub_challenge değeri (200 OK ile)
    """
    if hub_mode != "subscribe":
        raise HTTPException(status_code=400, detail="Invalid mode")
    
    expected_token = _get_verify_token()
    
    if hub_verify_token != expected_token:
        logger.warning(f"Geçersiz verify token: {hub_verify_token}")
        raise HTTPException(status_code=403, detail="Invalid verify token")
    
    logger.info(f"Meta webhook doğrulandı. Challenge: {hub_challenge}")
    
    # Meta challenge değerini bekliyor (200 OK ile)
    return int(hub_challenge)


@router.post("/meta")
async def meta_webhook_callback(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None),
    session: AsyncSession = Depends(get_db_session_optional),
):
    """
    Meta webhook callback endpoint'i.
    Tüm olaylar buraya POST edilir.
    
    Headers:
        X-Hub-Signature-256: Payload imzası (güvenlik)
    
    Body:
        {
            "object": "ads",
            "entry": [
                {
                    "id": "act_123",
                    "time": 1234567890,
                    "changes": [
                        {
                            "value": {
                                "campaign_id": "123",
                                "status": "PAUSED",
                                ...
                            },
                            "field": "status"
                        }
                    ]
                }
            ]
        }
    """
    # Payload'ı al
    body = await request.body()
    
    # İmza doğrulama
    if not _verify_signature(body, x_hub_signature_256):
        logger.error("Geçersiz webhook imzası")
        raise HTTPException(status_code=403, detail="Invalid signature")
    
    # JSON parse et
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        logger.error("Geçersiz JSON payload")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    # Object tipini kontrol et
    if payload.get("object") != "ads":
        logger.warning(f"Bilinmeyen object tipi: {payload.get('object')}")
        return {"status": "ignored", "reason": "unknown_object_type"}
    
    # Entry'leri işle
    entries = payload.get("entry", [])
    processed_count = 0
    
    for entry in entries:
        object_id = entry.get("id")  # act_xxx, campaign_xxx, adset_xxx, ad_xxx
        changes = entry.get("changes", [])
        time_unix = entry.get("time")
        
        # Object tipini belirle (ID prefix'inden)
        object_type = "unknown"
        if object_id:
            if object_id.startswith("act_"):
                object_type = "ad_account"
            elif object_id.startswith("campaign_"):
                object_type = "campaigns"
            elif object_id.startswith("adset_"):
                object_type = "adsets"
            elif object_id.startswith("ad_"):
                object_type = "ads"
        
        # Her değişikliği işle
        for change in changes:
            field = change.get("field")
            value = change.get("value", {})
            
            event_data = {
                "object_type": object_type,
                "object_id": object_id,
                "field": field,
                "value": value,
                "time": datetime.fromtimestamp(time_unix) if time_unix else datetime.utcnow(),
            }
            
            logger.info(f"[Meta Webhook] {object_type}:{object_id} - {field} değişti")
            
            # Değişikliği işle ve gerekirse uyarı gönder
            if session:
                changed_fields = [field] if field else []
                await _send_webhook_alert(
                    session=session,
                    object_type=object_type,
                    object_id=object_id,
                    changed_fields=changed_fields,
                    event_data=value
                )
            
            processed_count += 1
    
    # Her zaman 200 OK döndür (Meta tekrar denemesin)
    return {
        "status": "success",
        "processed": processed_count,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/config")
async def get_webhook_config():
    """
    Webhook yapılandırma durumunu döner.
    Frontend'de webhook kurulum rehberi için kullanılır.
    """
    verify_token = _get_verify_token()
    app_secret = _get_app_secret()
    
    # Webhook URL'sini oluştur (settings.json veya env'den al)
    base_url = config.get_setting("WEBHOOK_BASE_URL") or "https://your-domain.com"
    webhook_url = f"{base_url}/api/webhooks/meta"
    
    is_configured = bool(
        verify_token and 
        verify_token != "meta_ads_webhook_secret" and
        app_secret
    )
    
    return {
        "webhook_url": webhook_url,
        "verify_token": verify_token[:10] + "***" if verify_token else None,
        "app_secret_configured": bool(app_secret),
        "is_configured": is_configured,
        "required_permissions": [
            "ads_read",
            "ads_management"
        ],
        "supported_fields": list(EVENT_TYPES.keys()),
    }


@router.post("/test")
async def test_webhook_delivery(
    object_type: str = "campaigns",
    object_id: str = "campaign_123456",
    field: str = "status",
    new_value: str = "PAUSED",
    session: AsyncSession = Depends(get_db_session_optional),
):
    """
    Webhook sistemini test et (manuel tetikleme).
    Gerçek bir webhook olayı simüle eder.
    """
    event_data = {
        "status": new_value,
        "name": "Test Kampanyası",
    }
    
    await _send_webhook_alert(
        session=session,
        object_type=object_type,
        object_id=object_id,
        changed_fields=[field],
        event_data=event_data
    )
    
    return {
        "status": "test_triggered",
        "object_type": object_type,
        "object_id": object_id,
        "field": field,
        "new_value": new_value,
        "message": _format_change_message(object_type, object_id, [field]),
    }


# ============ Webhook Event History ============

# Bellek içi son webhook olayları (geliştirme için)
_recent_webhook_events: list = []
MAX_STORED_EVENTS = 100


@router.get("/events")
async def get_recent_webhook_events(
    limit: int = Query(50, ge=1, le=100),
    object_type: Optional[str] = Query(None),
):
    """
    Son webhook olaylarını döner (debug/izleme için).
    Not: Üretim ortamında Redis/DB kullanılmalı.
    """
    events = _recent_webhook_events
    
    if object_type:
        events = [e for e in events if e.get("object_type") == object_type]
    
    return {
        "events": events[-limit:],
        "total_stored": len(_recent_webhook_events),
    }


def _store_webhook_event(event: dict):
    """Webhook olayını belleğe kaydet (debug için)"""
    _recent_webhook_events.append(event)
    if len(_recent_webhook_events) > MAX_STORED_EVENTS:
        _recent_webhook_events.pop(0)
