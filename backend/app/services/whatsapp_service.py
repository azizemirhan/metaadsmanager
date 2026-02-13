"""
WhatsApp Business API (Cloud API) entegrasyon servisi.
Meta Cloud API üzerinden mesaj gönderimi, webhook işleme ve raporlama.

Gerekli izinler: whatsapp_business_management, whatsapp_business_messaging
"""

import httpx
import logging
from typing import Optional
from datetime import datetime
from app import config

logger = logging.getLogger(__name__)

WHATSAPP_API_VERSION = "v21.0"
WHATSAPP_BASE_URL = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}"


def _get_token() -> str:
    """WhatsApp API token (Meta Access Token veya Business token)."""
    return (config.get_setting("WHATSAPP_ACCESS_TOKEN") or config.get_setting("META_ACCESS_TOKEN") or "").strip()


def _get_phone_id() -> str:
    """WhatsApp Business Account Phone Number ID."""
    return (config.get_setting("WHATSAPP_PHONE_ID") or "").strip()


def _is_whatsapp_configured() -> bool:
    """WhatsApp API yapılandırması kontrolü."""
    token = _get_token()
    phone_id = _get_phone_id()
    if not token or not phone_id:
        return False
    if "xxxxxxxx" in token or token == "EAA":
        return False
    return True


class WhatsAppError(Exception):
    """WhatsApp API hataları için özel exception."""
    pass


class WhatsAppService:
    """WhatsApp Cloud API servisi - mesaj gönderme ve webhook işleme."""

    def __init__(self):
        self.base_url = WHATSAPP_BASE_URL

    async def _post(self, endpoint: str, data: dict) -> dict:
        """WhatsApp API'ye POST isteği gönder."""
        if not _is_whatsapp_configured():
            raise WhatsAppError(
                "WhatsApp API yapılandırılmamış. Lütfen WHATSAPP_PHONE_ID ve "
                "WHATSAPP_ACCESS_TOKEN (veya META_ACCESS_TOKEN) ayarlarını yapın."
            )
        
        headers = {
            "Authorization": f"Bearer {_get_token()}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/{endpoint}",
                json=data,
                headers=headers
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = {}
                try:
                    body = response.json()
                except Exception:
                    pass
                err = body.get("error", {})
                msg = err.get("message", str(e))
                code = err.get("code", "")
                logger.warning(f"WhatsApp API hata: status={response.status_code} code={code} message={msg}")
                raise WhatsAppError(f"WhatsApp API hatası: {msg}")
            
            return response.json()

    async def _get(self, endpoint: str, params: dict = None) -> dict:
        """WhatsApp API'ye GET isteği gönder."""
        if not _is_whatsapp_configured():
            raise WhatsAppError(
                "WhatsApp API yapılandırılmamış. Lütfen WHATSAPP_PHONE_ID ve "
                "WHATSAPP_ACCESS_TOKEN ayarlarını yapın."
            )
        
        headers = {"Authorization": f"Bearer {_get_token()}"}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.base_url}/{endpoint}",
                params=params,
                headers=headers
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = {}
                try:
                    body = response.json()
                except Exception:
                    pass
                err = body.get("error", {})
                msg = err.get("message", str(e))
                logger.warning(f"WhatsApp API GET hata: status={response.status_code} message={msg}")
                raise WhatsAppError(f"WhatsApp API hatası: {msg}")
            
            return response.json()

    def _format_phone_number(self, phone: str) -> str:
        """
        Telefon numarasını uluslararası formata çevir.
        + işaretini kaldır, boşlukları ve tireleri temizle.
        Örnek: +90 555 123 4567 -> 905551234567
        """
        cleaned = phone.replace("+", "").replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        return cleaned

    async def send_text_message(self, to_phone: str, message: str, preview_url: bool = False) -> dict:
        """
        Belirli bir numaraya metin mesajı gönder.
        
        Args:
            to_phone: Alıcı telefon numarası (uluslararası format, + işaretsiz)
            message: Gönderilecek mesaj metni
            preview_url: Mesajdaki URL'ler için önizleme göster
        
        Returns:
            API yanıtı (message_id vb.)
        """
        phone_id = _get_phone_id()
        formatted_phone = self._format_phone_number(to_phone)
        
        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": formatted_phone,
            "type": "text",
            "text": {
                "body": message,
                "preview_url": preview_url
            }
        }
        
        result = await self._post(f"{phone_id}/messages", data)
        logger.info(f"WhatsApp mesaj gönderildi: {formatted_phone}, message_id: {result.get('messages', [{}])[0].get('id')}")
        return result

    async def send_template_message(
        self, 
        to_phone: str, 
        template_name: str, 
        language_code: str = "tr",
        components: list = None
    ) -> dict:
        """
        Onaylı şablon kullanarak mesaj gönder (işletme mesajları için).
        
        Args:
            to_phone: Alıcı telefon numarası
            template_name: Meta'da onaylı şablon adı
            language_code: Şablon dili (varsayılan: tr)
            components: Şablon değişkenleri
        """
        phone_id = _get_phone_id()
        formatted_phone = self._format_phone_number(to_phone)
        
        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": formatted_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code}
            }
        }
        
        if components:
            data["template"]["components"] = components
        
        return await self._post(f"{phone_id}/messages", data)

    def format_report_message(
        self,
        period_days: int,
        summary: dict,
        campaigns: list,
        top_n: int = 3
    ) -> str:
        """
        Kampanya raporunu WhatsApp mesaj formatına dönüştür.
        
        Args:
            period_days: Rapor periyodu (gün)
            summary: Hesap özeti (spend, impressions, clicks, ctr, cpc)
            campaigns: Kampanya listesi
            top_n: Gösterilecek en iyi kampanya sayısı
        
        Returns:
            Formatlanmış mesaj metni
        """
        spend = float(summary.get("spend", 0))
        impressions = int(summary.get("impressions", 0))
        clicks = int(summary.get("clicks", 0))
        ctr = float(summary.get("ctr", 0))
        cpc = float(summary.get("cpc", 0))
        
        # En iyi kampanyalar
        top_campaigns = sorted(
            campaigns, 
            key=lambda c: float(c.get("spend", 0)), 
            reverse=True
        )[:top_n]
        
        lines = [
            f"📊 *Meta Ads Raporu - Son {period_days} Gün*",
            "",
            f"💰 Toplam Harcama: ₺{spend:,.2f}",
            f"👁️ Gösterim: {impressions:,}",
            f"🖱️ Tıklama: {clicks:,}",
            f"📈 Ort. CTR: %{ctr:.2f}",
            f"💵 Ort. CPC: ₺{cpc:.2f}",
            "",
            "🏆 *En İyi Kampanyalar:*"
        ]
        
        for i, c in enumerate(top_campaigns, 1):
            name = c.get("name", "Bilinmiyor")[:25]  # İsim çok uzunsa kısalt
            c_spend = float(c.get("spend", 0))
            c_ctr = float(c.get("ctr", 0))
            status = "🟢" if c.get("status") == "ACTIVE" else "⏸️"
            lines.append(f"{i}. {status} {name}")
            lines.append(f"   💰 ₺{c_spend:,.2f} | 📈 %{c_ctr:.2f} CTR")
        
        lines.extend([
            "",
            f"_{datetime.now().strftime('%d.%m.%Y %H:%M')} tarihinde oluşturuldu._"
        ])
        
        return "\n".join(lines)

    def format_daily_summary(
        self,
        summary: dict,
        campaign_count: int,
        active_count: int
    ) -> str:
        """
        Günlük özeti WhatsApp mesaj formatına dönüştür.
        
        Args:
            summary: Hesap özeti
            campaign_count: Toplam kampanya sayısı
            active_count: Aktif kampanya sayısı
        
        Returns:
            Formatlanmış mesaj metni
        """
        spend = float(summary.get("spend", 0))
        impressions = int(summary.get("impressions", 0))
        clicks = int(summary.get("clicks", 0))
        ctr = float(summary.get("ctr", 0))
        
        date_str = datetime.now().strftime("%d.%m.%Y")
        
        lines = [
            f"📊 *Meta Ads Günlük Özet - {date_str}*",
            "",
            f"💰 Harcama: ₺{spend:,.2f}",
            f"👁️ Gösterim: {impressions:,}",
            f"🖱️ Tıklama: {clicks:,}",
            f"📈 CTR: %{ctr:.2f}",
            "",
            f"📢 Kampanyalar: {active_count} aktif / {campaign_count} toplam"
        ]
        
        return "\n".join(lines)

    def format_alert_message(
        self,
        alert_type: str,
        message: str,
        campaign_name: Optional[str] = None,
        metric_value: Optional[float] = None,
        threshold: Optional[float] = None
    ) -> str:
        """
        Uyarı/alert mesajını formatla.
        
        Args:
            alert_type: Uyarı tipi (budget, performance, status)
            message: Uyarı mesajı
            campaign_name: İlgili kampanya adı (varsa)
            metric_value: Metrik değeri (varsa)
            threshold: Eşik değeri (varsa)
        
        Returns:
            Formatlanmış uyarı mesajı
        """
        icons = {
            "budget": "💸",
            "performance": "📉",
            "status": "⚠️",
            "error": "❌",
            "success": "✅"
        }
        
        icon = icons.get(alert_type, "🔔")
        lines = [f"{icon} *Meta Ads Uyarısı*", ""]
        
        if campaign_name:
            lines.append(f"📢 *{campaign_name}*")
            lines.append("")
        
        lines.append(message)
        
        if metric_value is not None and threshold is not None:
            lines.append(f"")
            lines.append(f"Değer: {metric_value} | Limit: {threshold}")
        
        lines.append("")
        lines.append(f"_{datetime.now().strftime('%d.%m.%Y %H:%M')}_")
        
        return "\n".join(lines)

    async def verify_webhook(self, mode: str, token: str, challenge: str) -> Optional[str]:
        """
        Webhook doğrulama isteğini kontrol et.
        
        Args:
            mode: Subscribe mode
            token: Verify token
            challenge: Challenge string
        
        Returns:
            Challenge değeri (doğrulama başarılıysa) veya None
        """
        verify_token = config.get_setting("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "")
        
        if mode == "subscribe" and token == verify_token:
            logger.info("WhatsApp webhook doğrulama başarılı")
            return challenge
        
        logger.warning("WhatsApp webhook doğrulama başarısız")
        return None

    def parse_incoming_message(self, data: dict) -> Optional[dict]:
        """
        Gelen webhook mesajını parse et.
        
        Args:
            data: Webhook JSON verisi
        
        Returns:
            Parse edilmiş mesaj bilgisi veya None
        """
        try:
            entry = data.get("entry", [{}])[0]
            changes = entry.get("changes", [{}])[0]
            value = changes.get("value", {})
            
            # Gelen mesaj
            messages = value.get("messages", [])
            if not messages:
                return None
            
            msg = messages[0]
            
            return {
                "message_id": msg.get("id"),
                "from_phone": msg.get("from"),
                "timestamp": msg.get("timestamp"),
                "type": msg.get("type"),
                "text": msg.get("text", {}).get("body", ""),
                "profile_name": value.get("contacts", [{}])[0].get("profile", {}).get("name", "")
            }
        except (KeyError, IndexError) as e:
            logger.warning(f"WhatsApp mesaj parse hatası: {e}")
            return None

    def get_welcome_message(self) -> str:
        """Karşılama mesajı."""
        return (
            "👋 *Meta Ads Dashboard Bot*\n\n"
            "Aşağıdaki komutları kullanabilirsiniz:\n\n"
            "📊 *Bugünkü harcama* - Günlük özet\n"
            "📈 *Son 7 gün* - Haftalık rapor\n"
            "📋 *Kampanyalar* - Aktif kampanya listesi\n"
            "🏆 *En iyi 5* - En çok harcama yapanlar\n\n"
            "Yardım için 'yardım' yazabilirsiniz."
        )

    def get_help_message(self) -> str:
        """Yardım mesajı."""
        return (
            "🤖 *Komutlar*\n\n"
            "• *Bugün* veya *bugünkü harcama* - Bugünün özeti\n"
            "• *7 gün* veya *haftalık* - Son 7 gün raporu\n"
            "• *30 gün* veya *aylık* - Son 30 gün raporu\n"
            "• *Kampanyalar* - Tüm aktif kampanyalar\n"
            "• *En iyi 5* - En çok harcama yapan 5 kampanya\n"
            "• *Özet* - Hızlı durum özeti\n"
            "• *Yardım* - Bu mesaj\n\n"
            "_Not: Bazı komutlar için Meta API bağlantısı gerekir._"
        )


# Global servis instance'ı
whatsapp_service = WhatsAppService()
