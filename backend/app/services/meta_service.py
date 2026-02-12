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


class MetaAdsService:
    def __init__(self):
        self.token = META_ACCESS_TOKEN
        self.account_id = META_AD_ACCOUNT_ID
        self.base_url = META_BASE_URL

    async def _get(self, endpoint: str, params: dict = {}) -> dict:
        """Meta API'ye GET isteği gönderir"""
        params["access_token"] = self.token
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}/{endpoint}", params=params)
            response.raise_for_status()
            return response.json()

    def _date_range(self, days: int = 30) -> dict:
        end = datetime.now()
        start = end - timedelta(days=days)
        return {
            "since": start.strftime("%Y-%m-%d"),
            "until": end.strftime("%Y-%m-%d")
        }

    async def get_campaigns(self, days: int = 30) -> list[dict]:
        """Tüm kampanyaları ve temel metriklerini getirir"""
        data = await self._get(
            f"{self.account_id}/campaigns",
            params={
                "fields": "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time",
                "date_preset": f"last_{days}d" if days <= 90 else "last_90d"
            }
        )
        campaigns = data.get("data", [])

        # Her kampanya için insights çek
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

    async def get_ad_sets(self, campaign_id: Optional[str] = None, days: int = 30) -> list[dict]:
        """Reklam setlerini getirir"""
        endpoint = f"{campaign_id}/adsets" if campaign_id else f"{self.account_id}/adsets"
        data = await self._get(
            endpoint,
            params={
                "fields": "id,name,status,targeting,daily_budget,lifetime_budget,campaign_id",
            }
        )
        return data.get("data", [])

    async def get_ads(self, campaign_id: Optional[str] = None, days: int = 30) -> list[dict]:
        """Reklamları getirir"""
        endpoint = f"{campaign_id}/ads" if campaign_id else f"{self.account_id}/ads"
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

    async def get_daily_breakdown(self, days: int = 30) -> list[dict]:
        """Günlük performans breakdown"""
        data = await self._get(
            f"{self.account_id}/insights",
            params={
                "fields": "impressions,clicks,spend,reach,ctr,cpc,actions",
                "time_range": str(self._date_range(days)).replace("'", '"'),
                "time_increment": "1"
            }
        )
        return data.get("data", [])

    async def get_account_summary(self, days: int = 30) -> dict:
        """Hesap geneli özet"""
        data = await self._get(
            f"{self.account_id}/insights",
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
