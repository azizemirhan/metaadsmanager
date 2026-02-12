import httpx
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN")
META_AD_ACCOUNT_ID = os.getenv("META_AD_ACCOUNT_ID")  # format: act_XXXXXXXXX
META_API_VERSION = "v21.0"
META_BASE_URL = f"https://graph.facebook.com/{META_API_VERSION}"


def _is_meta_configured() -> bool:
    """Token ve hesap ID gerçek değer mi (placeholder değil mi) kontrol eder."""
    token = (META_ACCESS_TOKEN or "").strip()
    account = (META_AD_ACCOUNT_ID or "").strip()
    if not token or not account:
        return False
    # Placeholder örnekleri
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
        self.token = META_ACCESS_TOKEN
        self.account_id = META_AD_ACCOUNT_ID
        self.base_url = META_BASE_URL

    async def _get(self, endpoint: str, params: dict = {}) -> dict:
        """Meta API'ye GET isteği gönderir"""
        if not _is_meta_configured():
            raise MetaAPIError(
                "Meta API yapılandırılmamış. Lütfen backend/.env dosyasında "
                "META_ACCESS_TOKEN ve META_AD_ACCOUNT_ID değerlerini gerçek Meta hesap bilgilerinizle doldurun."
            )
        params["access_token"] = self.token
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
                import logging
                logging.warning(f"Meta API hata: status={response.status_code} code={code} message={msg}")
                raise MetaAPIError(f"Meta API hatası: {msg}")
            return response.json()

    def _date_range(self, days: int = 30) -> dict:
        end = datetime.now()
        start = end - timedelta(days=days)
        return {
            "since": start.strftime("%Y-%m-%d"),
            "until": end.strftime("%Y-%m-%d")
        }

    def _resolve_account(self, ad_account_id: Optional[str] = None) -> str:
        """Return the account ID to use (provided or default)."""
        return ad_account_id or self.account_id

    async def get_ad_accounts(self) -> list[dict]:
        """Kullanicinin erisebilecegi reklam hesaplarini listele"""
        if not self.token or not self.token.strip():
            return []
        try:
            data = await self._get(
                "me/adaccounts",
                params={
                    "fields": "id,name,account_status,currency,timezone_name",
                    "limit": "50",
                }
            )
            accounts = data.get("data", [])
            # account_status: 1=ACTIVE, 2=DISABLED, 3=UNSETTLED
            return [
                {
                    "id": acc.get("id", ""),
                    "name": acc.get("name", ""),
                    "status": acc.get("account_status", 0),
                    "currency": acc.get("currency", ""),
                    "timezone": acc.get("timezone_name", ""),
                }
                for acc in accounts
            ]
        except Exception:
            return []

    async def get_campaigns(self, days: int = 30, ad_account_id: Optional[str] = None) -> list[dict]:
        """Tum kampanyalari ve temel metriklerini getirir"""
        if not _is_meta_configured():
            return []
        account = self._resolve_account(ad_account_id)
        data = await self._get(
            f"{account}/campaigns",
            params={
                "fields": "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
                "date_preset": f"last_{days}d" if days <= 90 else "last_90d"
            }
        )
        campaigns = data.get("data", [])
        if not campaigns:
            import logging
            logging.info(f"Meta API: Kampanya listesi bos (son {days} gun). Hesap: {account}")

        # Her kampanya icin insights cek
        enriched = []
        for campaign in campaigns:
            insights = await self.get_campaign_insights(campaign["id"], days)
            enriched.append({**campaign, **insights})

        return enriched

    async def get_campaign_insights(self, campaign_id: str, days: int = 30) -> dict:
        """Kampanya için performans metrikleri"""
        try:
            data = await self._get(
                f"{campaign_id}/insights",
                params={
                    "fields": "impressions,clicks,spend,reach,ctr,cpc,cpm,cpp,actions,action_values,frequency",
                    "time_range": str(self._date_range(days)).replace("'", '"')
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
        except Exception:
            pass
        return {
            "impressions": 0, "clicks": 0, "spend": 0, "reach": 0,
            "ctr": 0, "cpc": 0, "cpm": 0, "frequency": 0,
            "conversions": 0, "conversion_value": 0, "roas": 0
        }

    async def get_ad_sets(self, campaign_id: Optional[str] = None, days: int = 30, ad_account_id: Optional[str] = None) -> list[dict]:
        """Reklam setlerini getirir"""
        if not _is_meta_configured():
            return []
        account = self._resolve_account(ad_account_id)
        endpoint = f"{campaign_id}/adsets" if campaign_id else f"{account}/adsets"
        data = await self._get(
            endpoint,
            params={
                "fields": "id,name,status,targeting,daily_budget,lifetime_budget,campaign_id",
            }
        )
        return data.get("data", [])

    async def get_ads(self, campaign_id: Optional[str] = None, days: int = 30, ad_account_id: Optional[str] = None) -> list[dict]:
        """Reklamlari getirir"""
        if not _is_meta_configured():
            return []
        account = self._resolve_account(ad_account_id)
        endpoint = f"{campaign_id}/ads" if campaign_id else f"{account}/ads"
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

    async def get_daily_breakdown(self, days: int = 30, ad_account_id: Optional[str] = None) -> list[dict]:
        """Gunluk performans breakdown"""
        if not _is_meta_configured():
            return []
        account = self._resolve_account(ad_account_id)
        data = await self._get(
            f"{account}/insights",
            params={
                "fields": "impressions,clicks,spend,reach,ctr,cpc,actions",
                "time_range": str(self._date_range(days)).replace("'", '"'),
                "time_increment": "1"
            }
        )
        return data.get("data", [])

    async def get_account_summary(self, days: int = 30, ad_account_id: Optional[str] = None) -> dict:
        """Hesap geneli ozet"""
        if not _is_meta_configured():
            return {}
        account = self._resolve_account(ad_account_id)
        data = await self._get(
            f"{account}/insights",
            params={
                "fields": "impressions,clicks,spend,reach,ctr,cpc,cpm,actions,action_values",
                "time_range": str(self._date_range(days)).replace("'", '"'),
            }
        )
        if data.get("data"):
            return data["data"][0]
        return {}

    def campaigns_to_dataframe(self, campaigns: list[dict]) -> pd.DataFrame:
        """Kampanyaları DataFrame'e dönüştür"""
        return pd.DataFrame(campaigns)

    def to_csv(self, data: list[dict]) -> str:
        """Veriyi CSV string'e dönüştür"""
        df = pd.DataFrame(data)
        return df.to_csv(index=False)


meta_service = MetaAdsService()
