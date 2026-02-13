import asyncio
import json
import logging
import httpx
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
from app import config

logger = logging.getLogger(__name__)

load_dotenv()

META_API_VERSION = "v21.0"
META_BASE_URL = f"https://graph.facebook.com/{META_API_VERSION}"


def _get_token() -> str:
    return (config.get_setting("META_ACCESS_TOKEN") or "").strip()


def _get_default_account_id() -> str:
    return (config.get_setting("META_AD_ACCOUNT_ID") or "").strip()


def _is_meta_configured(account_id: Optional[str] = None) -> bool:
    """Token ve hesap ID gerçek değer mi (placeholder değil mi) kontrol eder."""
    token = _get_token()
    account = (account_id or _get_default_account_id()).strip()
    if not token or not account:
        return False
    if "xxxxxxxx" in token or token == "EAA":
        return False
    if account == "act_123456789" or "123456789" in account:
        return False
    return True


class MetaAPIError(Exception):
    """Meta API hataları için (router'da 503 dönmek için kullanılır)."""
    pass


class MetaAdsService:
    def __init__(self):
        self.base_url = META_BASE_URL

    async def _get(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """Meta API'ye GET isteği gönderir (endpoint zaten account_id içerir)."""
        if not _is_meta_configured():
            raise MetaAPIError(
                "Meta API yapılandırılmamış. Lütfen Ayarlar veya backend/.env dosyasında "
                "META_ACCESS_TOKEN ve META_AD_ACCOUNT_ID değerlerini gerçek Meta hesap bilgilerinizle doldurun."
            )
        params = dict(params) if params else {}
        params["access_token"] = _get_token()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}/{endpoint}", params=params)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = {}
                try:
                    body = response.json()
                except Exception:
                    pass
                err = body.get("error") or {}
                msg = err.get("message", str(e))
                code = err.get("code", "")
                logger.warning("Meta API hata: status=%s code=%s message=%s", response.status_code, code, msg)
                raise MetaAPIError(f"Meta API hatası: {msg}")
            return response.json()

    async def _post(self, endpoint: str, data: dict) -> dict:
        """Meta API'ye POST isteği (güncelleme / oluşturma)."""
        if not _is_meta_configured():
            raise MetaAPIError(
                "Meta API yapılandırılmamış. Lütfen Ayarlar veya backend/.env dosyasında "
                "META_ACCESS_TOKEN ve META_AD_ACCOUNT_ID değerlerini gerçek Meta hesap bilgilerinizle doldurun."
            )
        data["access_token"] = _get_token()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{self.base_url}/{endpoint}", data=data)
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = {}
                try:
                    body = response.json()
                except Exception:
                    pass
                err = body.get("error") or {}
                msg = err.get("message", str(e))
                logger.warning("Meta API POST hata: status=%s message=%s", response.status_code, msg)
                raise MetaAPIError(f"Meta API hatası: {msg}")
            return response.json()

    def _date_range(self, days: int = 30) -> dict:
        end = datetime.now()
        start = end - timedelta(days=days)
        return {
            "since": start.strftime("%Y-%m-%d"),
            "until": end.strftime("%Y-%m-%d")
        }

    async def get_campaigns(self, days: int = 30, account_id: Optional[str] = None) -> list[dict]:
        """Tüm kampanyaları ve temel metriklerini getirir"""
        aid = account_id or _get_default_account_id()
        if not _is_meta_configured(aid):
            return []
        data = await self._get(
            f"{aid}/campaigns",
            params={
                "fields": "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
                "date_preset": f"last_{days}d" if days <= 90 else "last_90d"
            }
        )
        campaigns = data.get("data", [])
        if not campaigns:
            logger.info("Meta API: Kampanya listesi boş (son %d gün). Hesap: %s", days, aid)

        # Her kampanya için insights çek (rate limit için araya kısa gecikme)
        enriched = []
        for campaign in campaigns:
            insights = await self.get_campaign_insights(campaign["id"], days)
            enriched.append({**campaign, **insights})
            await asyncio.sleep(0.5)

        return enriched

    async def get_campaign_insights(self, campaign_id: str, days: int = 30) -> dict:
        """Kampanya için performans metrikleri"""
        try:
            data = await self._get(
                f"{campaign_id}/insights",
                params={
                    "fields": "impressions,clicks,spend,reach,ctr,cpc,cpm,cpp,actions,action_values,frequency",
                    "time_range": json.dumps(self._date_range(days))
                }
            )
            if data.get("data"):
                insight = data["data"][0]
                # Dönüşüm hesapla
                conversions = 0
                conversion_value = 0
                for action in insight.get("actions", []):
                    if action["action_type"] in ["purchase", "lead", "complete_registration"]:
                        conversions += int(action.get("value", 0))
                for av in insight.get("action_values", []):
                    if av["action_type"] == "purchase":
                        conversion_value += float(av.get("value", 0))

                spend = float(insight.get("spend", 0))
                roas = conversion_value / spend if spend > 0 else 0

                return {
                    "impressions": int(insight.get("impressions", 0)),
                    "clicks": int(insight.get("clicks", 0)),
                    "spend": spend,
                    "reach": int(insight.get("reach", 0)),
                    "ctr": float(insight.get("ctr", 0)),
                    "cpc": float(insight.get("cpc", 0)),
                    "cpm": float(insight.get("cpm", 0)),
                    "frequency": float(insight.get("frequency", 0)),
                    "conversions": conversions,
                    "conversion_value": conversion_value,
                    "roas": round(roas, 2),
                }
        except Exception as e:
            logger.warning("get_campaign_insights hatası (campaign_id=%s): %s", campaign_id, e)
        return {
            "impressions": 0, "clicks": 0, "spend": 0, "reach": 0,
            "ctr": 0, "cpc": 0, "cpm": 0, "frequency": 0,
            "conversions": 0, "conversion_value": 0, "roas": 0
        }

    async def get_ad_sets(self, campaign_id: Optional[str] = None, days: int = 30, account_id: Optional[str] = None) -> list[dict]:
        """Reklam setlerini getirir"""
        aid = account_id or _get_default_account_id()
        if not _is_meta_configured(aid):
            return []
        endpoint = f"{campaign_id}/adsets" if campaign_id else f"{aid}/adsets"
        data = await self._get(
            endpoint,
            params={
                "fields": "id,name,status,targeting,daily_budget,lifetime_budget,campaign_id",
            }
        )
        return data.get("data", [])

    async def get_ads(self, campaign_id: Optional[str] = None, days: int = 30, account_id: Optional[str] = None) -> list[dict]:
        """Reklamları getirir"""
        aid = account_id or _get_default_account_id()
        if not _is_meta_configured(aid):
            return []
        endpoint = f"{campaign_id}/ads" if campaign_id else f"{aid}/ads"
        data = await self._get(
            endpoint,
            params={
                "fields": "id,name,status,creative,adset_id,campaign_id",
            }
        )
        ads = data.get("data", [])

        enriched = []
        for ad in ads:
            insights = await self.get_campaign_insights(ad["id"], days)
            enriched.append({**ad, **insights})
        return enriched

    async def get_daily_breakdown(self, days: int = 30, account_id: Optional[str] = None) -> list[dict]:
        """Günlük performans breakdown"""
        aid = account_id or _get_default_account_id()
        if not _is_meta_configured(aid):
            return []
        data = await self._get(
            f"{aid}/insights",
            params={
                "fields": "impressions,clicks,spend,reach,ctr,cpc,actions",
                "time_range": json.dumps(self._date_range(days)),
                "time_increment": "1"
            }
        )
        return data.get("data", [])

    async def get_account_summary(self, days: int = 30, account_id: Optional[str] = None) -> dict:
        """Hesap geneli özet"""
        aid = account_id or _get_default_account_id()
        if not _is_meta_configured(aid):
            return {}
        data = await self._get(
            f"{aid}/insights",
            params={
                "fields": "impressions,clicks,spend,reach,ctr,cpc,cpm,actions,action_values",
                "time_range": json.dumps(self._date_range(days)),
            }
        )
        if data.get("data"):
            return data["data"][0]
        return {}

    async def get_insights_with_breakdown(
        self,
        account_id: Optional[str] = None,
        days: int = 30,
        breakdowns: str = "publisher_platform",
        time_increment: Optional[str] = None,
    ) -> list[dict]:
        """Hesap insights'ı breakdown (yaş, cinsiyet, platform vb.) ile döndürür.
        platform_position ile actions/action_values birlikte kullanılamaz (Meta #100)."""
        aid = account_id or _get_default_account_id()
        if not _is_meta_configured(aid):
            return []
        # Meta API: platform_position breakdown ile actions/action_values geçersiz kombinasyon
        if breakdowns == "platform_position":
            fields = "impressions,clicks,spend,reach,ctr,cpc,cpm,frequency"
        else:
            fields = "impressions,clicks,spend,reach,ctr,cpc,cpm,actions,action_values,frequency"
        params = {
            "fields": fields,
            "time_range": json.dumps(self._date_range(days)),
            "breakdowns": breakdowns,
        }
        if time_increment:
            params["time_increment"] = time_increment
        try:
            data = await self._get(f"{aid}/insights", params=params)
            return data.get("data", [])
        except Exception as e:
            logger.warning("get_insights_with_breakdown hatası: %s", e)
            return []

    async def get_ad_sets_with_insights(self, days: int = 30, account_id: Optional[str] = None) -> list[dict]:
        """Reklam setlerini insights ile döndürür. Rate limit için istekler arası gecikme uygulanır."""
        adsets = await self.get_ad_sets(days=days, account_id=account_id)
        if not adsets:
            return []
        result = []
        for adset in adsets:
            try:
                insights = await self.get_campaign_insights(adset["id"], days)
                result.append({**adset, **insights})
            except Exception:
                result.append({**adset, "spend": 0, "impressions": 0, "clicks": 0, "ctr": 0, "cpc": 0, "cpm": 0, "conversions": 0, "roas": 0})
            await asyncio.sleep(0.5)
        return result

    def campaigns_to_dataframe(self, campaigns: list[dict]) -> pd.DataFrame:
        """Kampanyaları DataFrame'e dönüştür"""
        return pd.DataFrame(campaigns)

    def to_csv(self, data: list[dict]) -> str:
        """Veriyi CSV string'e dönüştür"""
        df = pd.DataFrame(data)
        return df.to_csv(index=False)

    # --- Faz 7: Güncelleme (status, bütçe) ---
    async def update_campaign_status(self, campaign_id: str, status: str) -> dict:
        """Kampanya durumunu günceller (ACTIVE, PAUSED, ARCHIVED)."""
        if status.upper() not in ("ACTIVE", "PAUSED", "ARCHIVED"):
            raise MetaAPIError("Geçersiz status. ACTIVE, PAUSED veya ARCHIVED olmalı.")
        return await self._post(campaign_id, {"status": status.upper()})

    async def update_adset_budget(
        self,
        adset_id: str,
        daily_budget: Optional[float] = None,
        lifetime_budget: Optional[float] = None,
    ) -> dict:
        """Reklam seti bütçesini günceller. Bütçe hesap para biriminin en küçük biriminde (örn. TL için kuruş)."""
        if daily_budget is None and lifetime_budget is None:
            raise MetaAPIError("daily_budget veya lifetime_budget verilmeli.")
        data = {}
        if daily_budget is not None:
            data["daily_budget"] = int(round(daily_budget))
        if lifetime_budget is not None:
            data["lifetime_budget"] = int(round(lifetime_budget))
        return await self._post(adset_id, data)

    # --- Faz 8: Oluşturma (campaign, adset, creative, ad) ---
    async def create_campaign(
        self,
        account_id: str,
        name: str,
        objective: str = "OUTCOME_TRAFFIC",
        status: str = "PAUSED",
    ) -> dict:
        """Yeni kampanya oluşturur."""
        if status.upper() not in ("ACTIVE", "PAUSED"):
            status = "PAUSED"
        data = {
            "name": name,
            "objective": objective,
            "status": status.upper(),
            "special_ad_categories": "[]",
            "is_adset_budget_sharing_enabled": "0",
        }
        return await self._post(f"{account_id}/campaigns", data)

    async def create_adset(
        self,
        account_id: str,
        campaign_id: str,
        name: str,
        daily_budget: Optional[int] = None,
        lifetime_budget: Optional[int] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        targeting: Optional[dict] = None,
        billing_event: str = "LINK_CLICKS",
        optimization_goal: str = "LINK_CLICKS",
        status: str = "PAUSED",
    ) -> dict:
        """Yeni reklam seti oluşturur. Bütçe hesap para biriminin en küçük biriminde (örn. kuruş)."""
        if daily_budget is None and lifetime_budget is None:
            raise MetaAPIError("daily_budget veya lifetime_budget gerekli.")
        if not start_time:
            start_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%S%z")
        if not end_time and lifetime_budget:
            end_d = datetime.now() + timedelta(days=30)
            end_time = end_d.strftime("%Y-%m-%dT%H:%M:%S%z")
        if not targeting:
            targeting = {
                "geo_locations": {"countries": ["TR"]},
                "publisher_platforms": ["facebook", "instagram", "audience_network"],
            }
        data = {
            "name": name,
            "campaign_id": campaign_id,
            "start_time": start_time,
            "end_time": end_time or "0",
            "billing_event": billing_event,
            "optimization_goal": optimization_goal,
            "targeting": json.dumps(targeting),
            "status": status.upper(),
        }
        if daily_budget is not None:
            data["daily_budget"] = str(int(daily_budget))
        if lifetime_budget is not None:
            data["lifetime_budget"] = str(int(lifetime_budget))
        return await self._post(f"{account_id}/adsets", data)

    async def upload_ad_image(self, account_id: str, image_url: str) -> dict:
        """Meta'ya görsel yükler (URL ile). Dönen hash kreatifte kullanılır."""
        if not _is_meta_configured(account_id):
            raise MetaAPIError("Meta API yapılandırılmamış.")
        data = {"url": image_url, "access_token": _get_token()}
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/{account_id}/adimages",
                data=data,
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = {}
                try:
                    body = response.json()
                except Exception:
                    pass
                err = body.get("error") or {}
                raise MetaAPIError(err.get("message", str(e)))
            out = response.json()
            images = out.get("images") or {}
            # images: {"filename": {"hash": "abc123", ...}} veya {"hash_value": ...}
            for key, val in images.items():
                if isinstance(val, dict) and "hash" in val:
                    return {"hash": val["hash"]}
            # Fallback: ilk key'i hash olarak kullan
            if images:
                return {"hash": next(iter(images))}
            raise MetaAPIError("Görsel yükleme yanıtında hash bulunamadı.")

    async def upload_ad_video(self, account_id: str, video_url: str, title: Optional[str] = None) -> dict:
        """Meta'ya video yükler (URL ile). Dönen video_id kreatifte kullanılır."""
        if not _is_meta_configured(account_id):
            raise MetaAPIError("Meta API yapılandırılmamış.")
        data = {"file_url": video_url, "access_token": _get_token()}
        if title:
            data["title"] = title
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/{account_id}/advideos",
                data=data,
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = {}
                try:
                    body = response.json()
                except Exception:
                    pass
                err = body.get("error") or {}
                raise MetaAPIError(err.get("message", str(e)))
            out = response.json()
            video_id = out.get("id")
            if not video_id:
                raise MetaAPIError("Video yükleme yanıtında id bulunamadı.")
            return {"video_id": video_id}

    async def create_ad_creative(
        self,
        account_id: str,
        name: str,
        image_hash: Optional[str] = None,
        video_id: Optional[str] = None,
        link: str = "",
        message: str = "",
        headline: str = "",
        call_to_action: str = "LEARN_MORE",
    ) -> dict:
        """Kreatif oluşturur (görsel veya video + link)."""
        if not image_hash and not video_id:
            raise MetaAPIError("image_hash veya video_id gerekli.")
        link_data = {
            "link": link or "https://www.facebook.com",
            "message": message or "",
            "name": headline or "Reklam",
            "call_to_action": {"type": call_to_action},
        }
        if image_hash:
            link_data["image_hash"] = image_hash
        if video_id:
            link_data["video_id"] = video_id
        spec = {"link_data": link_data}
        data = {
            "name": name,
            "object_story_spec": json.dumps(spec),
            "access_token": _get_token(),
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/{account_id}/adcreatives",
                data=data,
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                body = {}
                try:
                    body = response.json()
                except Exception:
                    pass
                err = body.get("error") or {}
                raise MetaAPIError(err.get("message", str(e)))
            return response.json()

    async def create_ad(
        self,
        account_id: str,
        adset_id: str,
        creative_id: str,
        name: str,
        status: str = "PAUSED",
    ) -> dict:
        """Reklam oluşturur."""
        data = {
            "adset_id": adset_id,
            "creative": json.dumps({"creative_id": creative_id}),
            "name": name,
            "status": status.upper(),
        }
        return await self._post(f"{account_id}/ads", data)


meta_service = MetaAdsService()
