# -*- coding: utf-8 -*-
"""
Meta Ads Library Servisi.
Herkese açık Meta Reklam Kitaplığı API'si — rakip reklamlarını arar.
Token gerekir ancak hesap ID gerekmez.

Dökümantasyon: https://developers.facebook.com/docs/marketing-api/reference/ads-archive
"""
import json
import logging
from typing import Optional
import httpx

from app import config

logger = logging.getLogger(__name__)

META_API_VERSION = "v21.0"
ADS_LIBRARY_URL = f"https://graph.facebook.com/{META_API_VERSION}/ads_archive"


class AdsLibraryError(Exception):
    pass


def _get_token() -> str:
    return (config.get_setting("META_ACCESS_TOKEN") or "").strip()


def _token_ok() -> bool:
    t = _get_token()
    return bool(t) and "xxxxxxxx" not in t and t != "EAA"


class AdsLibraryService:
    """Meta Ads Library (Reklam Kitaplığı) API istemcisi."""

    async def search_ads(
        self,
        search_terms: str = "",
        countries: list[str] | None = None,
        ad_type: str = "ALL",
        active_status: str = "ALL",
        page_ids: list[str] | None = None,
        date_min: str = "",
        date_max: str = "",
        limit: int = 25,
    ) -> dict:
        """Reklam kitaplığında arama yapar."""
        if not _token_ok():
            raise AdsLibraryError(
                "Meta API token yapılandırılmamış. Lütfen Ayarlar sayfasında META_ACCESS_TOKEN değerini girin."
            )
        if not countries:
            countries = ["TR"]

        params: dict = {
            "access_token": _get_token(),
            "ad_reached_countries": json.dumps(countries),
            "ad_type": ad_type,
            "ad_active_status": active_status,
            "fields": (
                "id,ad_creative_bodies,ad_creative_link_captions,"
                "ad_creative_link_titles,ad_creative_link_descriptions,"
                "page_id,page_name,ad_snapshot_url,"
                "ad_delivery_start_time,ad_delivery_stop_time,"
                "ad_reach_countries,bylines"
            ),
            "limit": min(limit, 100),
        }

        if search_terms:
            params["search_terms"] = search_terms
        if page_ids:
            params["search_page_ids"] = ",".join(p.strip() for p in page_ids if p.strip())
        if date_min:
            params["ad_delivery_date_min"] = date_min
        if date_max:
            params["ad_delivery_date_max"] = date_max

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(ADS_LIBRARY_URL, params=params)
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                body = {}
                try:
                    body = resp.json()
                except Exception:
                    pass
                err = (body.get("error") or {})
                msg = err.get("message", f"HTTP {resp.status_code}")
                raise AdsLibraryError(f"Ads Library API hatası: {msg}")
            data = resp.json()

        ads = data.get("data", [])
        paging = data.get("paging", {})
        next_cursor = paging.get("cursors", {}).get("after")

        return {
            "ads": [self._normalize_ad(a) for a in ads],
            "count": len(ads),
            "next_cursor": next_cursor,
        }

    async def get_page_info(self, page_id: str) -> dict:
        """Sayfa bilgilerini getirir (isim, kategori, takipçi sayısı)."""
        if not _token_ok():
            raise AdsLibraryError("Meta API token yapılandırılmamış.")
        params = {
            "access_token": _get_token(),
            "fields": "id,name,category,fan_count,picture{url},website",
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"https://graph.facebook.com/{META_API_VERSION}/{page_id}",
                params=params,
            )
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError:
                body = {}
                try:
                    body = resp.json()
                except Exception:
                    pass
                err = (body.get("error") or {})
                raise AdsLibraryError(err.get("message", f"HTTP {resp.status_code}"))
            return resp.json()

    async def get_page_ads_count(self, page_id: str, country: str = "TR") -> dict:
        """Belirli bir sayfanın aktif reklam sayısını döner."""
        result = await self.search_ads(
            page_ids=[page_id],
            countries=[country],
            active_status="ACTIVE",
            limit=1,
        )
        # Meta API aktif sayısını doğrudan vermez — count >= 1 demek aktif var
        return {"page_id": page_id, "has_active_ads": result["count"] > 0}

    @staticmethod
    def _normalize_ad(raw: dict) -> dict:
        """API çıktısını ön uca uygun formata çevirir."""
        bodies = raw.get("ad_creative_bodies") or []
        titles = raw.get("ad_creative_link_titles") or []
        captions = raw.get("ad_creative_link_captions") or []
        descriptions = raw.get("ad_creative_link_descriptions") or []

        return {
            "id": raw.get("id"),
            "page_id": raw.get("page_id"),
            "page_name": raw.get("page_name", ""),
            "body": bodies[0] if bodies else "",
            "bodies": bodies,
            "title": titles[0] if titles else "",
            "caption": captions[0] if captions else "",
            "description": descriptions[0] if descriptions else "",
            "snapshot_url": raw.get("ad_snapshot_url", ""),
            "start_date": raw.get("ad_delivery_start_time", ""),
            "stop_date": raw.get("ad_delivery_stop_time", ""),
            "countries": raw.get("ad_reach_countries") or [],
            "bylines": raw.get("bylines") or [],
            "is_active": not raw.get("ad_delivery_stop_time"),
        }


ads_library_service = AdsLibraryService()
