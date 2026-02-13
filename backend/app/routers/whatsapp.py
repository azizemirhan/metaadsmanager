"""
WhatsApp Business API router.
- Rapor gönderimi
- Webhook işleme (bot)
- Uyarı bildirimleri
"""

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from typing import Optional, Literal
import logging

from app.services.whatsapp_service import whatsapp_service, WhatsAppError
from app.services.meta_service import meta_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/whatsapp", tags=["WhatsApp"])


# --- Request/Response Modelleri ---

class SendReportRequest(BaseModel):
    to_phone: str = Field(..., description="Alıcı telefon numarası (uluslararası format, örn: 905551234567)")
    period_days: int = Field(default=7, ge=1, le=365, description="Rapor periyodu (gün)")
    ad_account_id: Optional[str] = Field(None, description="Reklam hesabı ID (opsiyonel)")


class SendReportResponse(BaseModel):
    success: bool
    message: str
    message_id: Optional[str] = None
    recipient: Optional[str] = None


class SendAlertRequest(BaseModel):
    to_phone: str = Field(..., description="Alıcı telefon numarası")
    alert_type: Literal["budget", "performance", "status", "error", "success"] = Field(..., description="Uyarı tipi")
    message: str = Field(..., description="Uyarı mesajı")
    campaign_name: Optional[str] = Field(None, description="İlgili kampanya adı")
    metric_value: Optional[float] = Field(None, description="Metrik değeri")
    threshold: Optional[float] = Field(None, description="Eşik değeri")


class WebhookVerificationResponse(BaseModel):
    challenge: str


class BotCommandResponse(BaseModel):
    command: str
    response: str
    recipient: str


# --- Faz 1: Rapor Gönderimi ---

@router.post("/send-report", response_model=SendReportResponse)
async def send_whatsapp_report(request: SendReportRequest):
    """
    Belirtilen telefon numarasına Meta Ads raporu gönder.
    
    Özet bilgiler (harcama, gösterim, tıklama, CTR) ve en iyi kampanyalar WhatsApp mesajı olarak gönderilir.
    """
    try:
        # Meta verilerini çek
        summary = await meta_service.get_account_summary(request.period_days, request.ad_account_id)
        campaigns = await meta_service.get_campaigns(request.period_days, request.ad_account_id)
        
        if not summary and not campaigns:
            return SendReportResponse(
                success=False,
                message="Rapor için veri bulunamadı. Meta API bağlantısını kontrol edin.",
                recipient=request.to_phone
            )
        
        # WhatsApp mesajı formatla
        message = whatsapp_service.format_report_message(
            period_days=request.period_days,
            summary=summary or {},
            campaigns=campaigns,
            top_n=3
        )
        
        # Mesajı gönder
        result = await whatsapp_service.send_text_message(
            to_phone=request.to_phone,
            message=message
        )
        
        message_id = result.get("messages", [{}])[0].get("id")
        
        return SendReportResponse(
            success=True,
            message=f"Rapor başarıyla gönderildi ({request.period_days} gün).",
            message_id=message_id,
            recipient=request.to_phone
        )
        
    except WhatsAppError as e:
        logger.error(f"WhatsApp rapor gönderme hatası: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Beklenmeyen hata: {e}")
        raise HTTPException(status_code=500, detail=f"Rapor gönderilirken hata: {str(e)}")


@router.post("/send-daily-summary", response_model=SendReportResponse)
async def send_daily_summary(
    to_phone: str = Query(..., description="Alıcı telefon numarası"),
    ad_account_id: Optional[str] = Query(None, description="Reklam hesabı ID")
):
    """
    Günlük özeti WhatsApp'a gönder.
    """
    try:
        summary = await meta_service.get_account_summary(1, ad_account_id)
        campaigns = await meta_service.get_campaigns(1, ad_account_id)
        
        active_count = len([c for c in campaigns if c.get("status") == "ACTIVE"])
        
        message = whatsapp_service.format_daily_summary(
            summary=summary or {},
            campaign_count=len(campaigns),
            active_count=active_count
        )
        
        result = await whatsapp_service.send_text_message(to_phone, message)
        message_id = result.get("messages", [{}])[0].get("id")
        
        return SendReportResponse(
            success=True,
            message="Günlük özet gönderildi.",
            message_id=message_id,
            recipient=to_phone
        )
        
    except WhatsAppError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Faz 2: Uyarı Bildirimleri ---

@router.post("/send-alert", response_model=SendReportResponse)
async def send_whatsapp_alert(request: SendAlertRequest):
    """
    Belirtilen numaraya uyarı/alert mesajı gönder.
    """
    try:
        message = whatsapp_service.format_alert_message(
            alert_type=request.alert_type,
            message=request.message,
            campaign_name=request.campaign_name,
            metric_value=request.metric_value,
            threshold=request.threshold
        )
        
        result = await whatsapp_service.send_text_message(request.to_phone, message)
        message_id = result.get("messages", [{}])[0].get("id")
        
        return SendReportResponse(
            success=True,
            message="Uyarı gönderildi.",
            message_id=message_id,
            recipient=request.to_phone
        )
        
    except WhatsAppError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-budget-alert")
async def check_budget_alert(
    to_phone: str = Query(..., description="Bildirim gönderilecek numara"),
    daily_limit: float = Query(..., description="Günlük harcama limiti (TL)"),
    ad_account_id: Optional[str] = Query(None, description="Reklam hesabı ID")
):
    """
    Günlük harcamayı kontrol et, limit aşıldıysa WhatsApp bildirimi gönder.
    """
    try:
        summary = await meta_service.get_account_summary(1, ad_account_id)
        spend = float(summary.get("spend", 0))
        
        if spend >= daily_limit:
            message = (
                f"💸 *Bütçe Uyarısı*\n\n"
                f"Bugünkü harcama: ₺{spend:,.2f}\n"
                f"Günlük limit: ₺{daily_limit:,.2f}\n\n"
                f"⚠️ Limit aşıldı! Kampanyaları kontrol edin."
            )
            
            result = await whatsapp_service.send_text_message(to_phone, message)
            
            return {
                "alert_sent": True,
                "spend": spend,
                "limit": daily_limit,
                "message_id": result.get("messages", [{}])[0].get("id")
            }
        
        return {
            "alert_sent": False,
            "spend": spend,
            "limit": daily_limit,
            "remaining": daily_limit - spend
        }
        
    except WhatsAppError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Faz 3: Bot Webhook ---

@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge")
):
    """
    WhatsApp webhook doğrulama endpoint'i.
    Meta Developer Console'da webhook URL'si kaydederken buraya yönlendirilir.
    """
    from app import config
    
    verify_token = config.get_setting("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")
    
    if hub_mode == "subscribe" and hub_verify_token == verify_token:
        logger.info("WhatsApp webhook doğrulandı")
        # Challenge değerini plain text olarak döndür
        return Response(content=hub_challenge, media_type="text/plain")
    
    logger.warning("WhatsApp webhook doğrulama başarısız")
    raise HTTPException(status_code=403, detail="Doğrulama başarısız")


@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    WhatsApp'tan gelen mesajları al ve yanıtla.
    Basit komut botu olarak çalışır.
    """
    try:
        data = await request.json()
        logger.debug(f"WhatsApp webhook verisi: {data}")
        
        # Gelen mesajı parse et
        message_data = whatsapp_service.parse_incoming_message(data)
        if not message_data:
            return {"status": "ok", "message": "No message to process"}
        
        phone = message_data["from_phone"]
        text = message_data["text"].lower().strip()
        
        logger.info(f"WhatsApp mesaj alındı: {phone} - '{text[:50]}...'")
        
        # Komutları işle
        response_text = await process_bot_command(text)
        
        # Yanıt gönder
        if response_text:
            await whatsapp_service.send_text_message(phone, response_text)
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Webhook işleme hatası: {e}")
        return {"status": "error", "message": str(e)}


async def process_bot_command(text: str) -> str:
    """
    Gelen mesajı komut olarak işle ve yanıt döndür.
    
    Desteklenen komutlar:
    - Bugün, bugünkü harcama: Günlük özet
    - 7 gün, haftalık, son 7: Haftalık rapor
    - 30 gün, aylık: Aylık rapor
    - Kampanyalar, aktif kampanyalar: Kampanya listesi
    - En iyi 5, top 5: En çok harcama yapanlar
    - Özet: Hızlı özet
    - Yardım, help: Komut listesi
    - Merhaba, selam: Karşılama
    """
    # Yardım
    if any(word in text for word in ["yardım", "help", "komut", "nasıl"]):
        return whatsapp_service.get_help_message()
    
    # Karşılama
    if any(word in text for word in ["merhaba", "selam", "hello", "hi", "hey"]):
        return whatsapp_service.get_welcome_message()
    
    try:
        # Günlük özet
        if any(phrase in text for phrase in ["bugün", "bugunkü", "günlük", "dün", "bugunku"]):
            summary = await meta_service.get_account_summary(1)
            campaigns = await meta_service.get_campaigns(1)
            active_count = len([c for c in campaigns if c.get("status") == "ACTIVE"])
            
            return whatsapp_service.format_daily_summary(
                summary=summary or {},
                campaign_count=len(campaigns),
                active_count=active_count
            )
        
        # 7 günlük rapor
        if any(phrase in text for phrase in ["7 gün", "7gun", "haftalık", "haftalik", "son 7"]):
            summary = await meta_service.get_account_summary(7)
            campaigns = await meta_service.get_campaigns(7)
            
            return whatsapp_service.format_report_message(
                period_days=7,
                summary=summary or {},
                campaigns=campaigns,
                top_n=3
            )
        
        # 30 günlük rapor
        if any(phrase in text for phrase in ["30 gün", "30gun", "aylık", "aylik", "son 30"]):
            summary = await meta_service.get_account_summary(30)
            campaigns = await meta_service.get_campaigns(30)
            
            return whatsapp_service.format_report_message(
                period_days=30,
                summary=summary or {},
                campaigns=campaigns,
                top_n=5
            )
        
        # Kampanya listesi
        if any(phrase in text for phrase in ["kampanya", "kampanyalar", "aktif"]):
            campaigns = await meta_service.get_campaigns(30)
            active = [c for c in campaigns if c.get("status") == "ACTIVE"]
            
            if not active:
                return "📋 Aktif kampanya bulunamadı."
            
            lines = [f"📋 *Aktif Kampanyalar ({len(active)})*", ""]
            for c in active[:10]:  # Max 10
                name = c.get("name", "Bilinmiyor")[:20]
                spend = float(c.get("spend", 0))
                lines.append(f"🟢 {name} - ₺{spend:,.0f}")
            
            if len(active) > 10:
                lines.append(f"\n... ve {len(active) - 10} daha")
            
            return "\n".join(lines)
        
        # En iyi 5
        if any(phrase in text for phrase in ["en iyi", "top 5", "en çok", "en cok", "en çok harcama"]):
            campaigns = await meta_service.get_campaigns(30)
            top = sorted(campaigns, key=lambda c: float(c.get("spend", 0)), reverse=True)[:5]
            
            if not top:
                return "📊 Kampanya verisi bulunamadı."
            
            lines = ["🏆 *En Çok Harcama Yapan 5 Kampanya*", ""]
            for i, c in enumerate(top, 1):
                name = c.get("name", "Bilinmiyor")[:22]
                spend = float(c.get("spend", 0))
                status = "🟢" if c.get("status") == "ACTIVE" else "⏸️"
                lines.append(f"{i}. {status} {name}")
                lines.append(f"   💰 ₺{spend:,.2f}")
            
            return "\n".join(lines)
        
        # Özet
        if any(phrase in text for phrase in ["özet", "summary", "durum", "rapor"]):
            summary = await meta_service.get_account_summary(7)
            campaigns = await meta_service.get_campaigns(7)
            
            spend = float(summary.get("spend", 0))
            clicks = int(summary.get("clicks", 0))
            ctr = float(summary.get("ctr", 0))
            active = len([c for c in campaigns if c.get("status") == "ACTIVE"])
            
            return (
                f"📊 *Hızlı Özet*\n\n"
                f"💰 7 günlük harcama: ₺{spend:,.2f}\n"
                f"🖱️ Tıklama: {clicks:,}\n"
                f"📈 CTR: %{ctr:.2f}\n"
                f"📢 Aktif kampanya: {active}\n\n"
                f"Detaylı rapor için '7 gün' veya '30 gün' yazabilirsiniz."
            )
        
        # Bilinmeyen komut
        return (
            "🤔 Komutu anlayamadım.\n\n"
            "Kullanılabilir komutlar:\n"
            "• *Bugün* - Günlük özet\n"
            "• *7 gün* - Haftalık rapor\n"
            "• *Kampanyalar* - Aktif kampanyalar\n"
            "• *Yardım* - Tüm komutlar\n\n"
            "Lütfen tekrar deneyin."
        )
        
    except Exception as e:
        logger.error(f"Bot komut işleme hatası: {e}")
        return (
            "❌ Veri alınırken bir hata oluştu.\n\n"
            "Lütfen daha sonra tekrar deneyin veya Meta API ayarlarını kontrol edin."
        )


# --- Sağlık Kontrolü ---

@router.get("/health")
async def whatsapp_health_check():
    """WhatsApp API bağlantı durumunu kontrol et."""
    from app.services.whatsapp_service import _is_whatsapp_configured, _get_phone_id
    
    is_configured = _is_whatsapp_configured()
    
    return {
        "configured": is_configured,
        "phone_id": _get_phone_id()[:6] + "..." if _get_phone_id() else None,
        "message": "WhatsApp API yapılandırılmış" if is_configured else "WHATSAPP_PHONE_ID ve WHATSAPP_ACCESS_TOKEN gerekli"
    }
