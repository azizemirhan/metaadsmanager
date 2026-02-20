# -*- coding: utf-8 -*-
"""
Campaigns router testleri.
Meta API çağrıları mock'lanır; gerçek hesap bilgisi gerekmez.
"""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient

# Örnek kampanya verisi (Meta API response taklidi)
MOCK_CAMPAIGNS = [
    {
        "id": "camp_001",
        "name": "Yaz Kampanyası",
        "status": "ACTIVE",
        "objective": "OUTCOME_TRAFFIC",
        "spend": 1500.0,
        "impressions": 50000,
        "clicks": 750,
        "ctr": 1.5,
        "cpc": 2.0,
        "cpm": 30.0,
        "roas": 3.2,
        "frequency": 2.1,
    },
    {
        "id": "camp_002",
        "name": "Kış Kampanyası",
        "status": "PAUSED",
        "objective": "OUTCOME_SALES",
        "spend": 800.0,
        "impressions": 25000,
        "clicks": 300,
        "ctr": 1.2,
        "cpc": 2.67,
        "cpm": 32.0,
        "roas": 1.8,
        "frequency": 1.5,
    },
]

MOCK_SUMMARY = {
    "total_spend": 2300.0,
    "total_impressions": 75000,
    "total_clicks": 1050,
    "avg_ctr": 1.4,
    "avg_cpc": 2.19,
    "avg_cpm": 30.67,
    "avg_roas": 2.67,
    "active_campaigns": 1,
    "paused_campaigns": 1,
}


class TestCampaignsListEndpoint:
    async def test_list_campaigns_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/campaigns")
        assert response.status_code == 401

    async def test_list_campaigns_with_valid_auth(
        self, client: AsyncClient, auth_headers: dict
    ):
        with patch(
            "app.services.meta_service.MetaAdsService.get_campaigns",
            new_callable=AsyncMock,
            return_value=MOCK_CAMPAIGNS,
        ):
            response = await client.get("/api/campaigns", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert "count" in body
        assert body["count"] == 2

    async def test_list_campaigns_returns_correct_fields(
        self, client: AsyncClient, auth_headers: dict
    ):
        with patch(
            "app.services.meta_service.MetaAdsService.get_campaigns",
            new_callable=AsyncMock,
            return_value=MOCK_CAMPAIGNS,
        ):
            response = await client.get("/api/campaigns", headers=auth_headers)
        campaigns = response.json()["data"]
        first = campaigns[0]
        assert "id" in first
        assert "name" in first
        assert "status" in first
        assert "spend" in first

    async def test_list_campaigns_with_days_param(
        self, client: AsyncClient, auth_headers: dict
    ):
        with patch(
            "app.services.meta_service.MetaAdsService.get_campaigns",
            new_callable=AsyncMock,
            return_value=MOCK_CAMPAIGNS,
        ) as mock_get:
            response = await client.get("/api/campaigns?days=14", headers=auth_headers)
        assert response.status_code == 200

    async def test_list_campaigns_meta_api_error_returns_503(
        self, client: AsyncClient, auth_headers: dict
    ):
        from app.services.meta_service import MetaAPIError
        with patch(
            "app.services.meta_service.MetaAdsService.get_campaigns",
            new_callable=AsyncMock,
            side_effect=MetaAPIError("Meta API yapılandırılmamış"),
        ):
            response = await client.get("/api/campaigns", headers=auth_headers)
        assert response.status_code == 503


class TestCampaignsSummaryEndpoint:
    async def test_summary_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/campaigns/summary")
        assert response.status_code == 401

    async def test_summary_returns_metrics(
        self, client: AsyncClient, auth_headers: dict
    ):
        with patch(
            "app.services.meta_service.MetaAdsService.get_account_summary",
            new_callable=AsyncMock,
            return_value=MOCK_SUMMARY,
        ):
            response = await client.get("/api/campaigns/summary", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert "total_spend" in body or "data" in body


class TestCampaignsAccountsEndpoint:
    async def test_accounts_endpoint_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/campaigns/accounts")
        assert response.status_code == 401

    async def test_accounts_returns_list(
        self, client: AsyncClient, auth_headers: dict
    ):
        response = await client.get("/api/campaigns/accounts", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert isinstance(body["data"], list)


class TestCreateCampaignEndpoint:
    async def test_create_campaign_requires_auth(self, client: AsyncClient):
        payload = {"name": "Test Kampanya", "objective": "OUTCOME_TRAFFIC"}
        response = await client.post("/api/campaigns", json=payload)
        assert response.status_code == 401

    async def test_create_campaign_success(
        self, client: AsyncClient, auth_headers: dict
    ):
        mock_result = {"id": "new_camp_001", "name": "Test Kampanya", "status": "PAUSED"}
        with patch(
            "app.services.meta_service.MetaAdsService.create_campaign",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            payload = {
                "name": "Test Kampanya",
                "objective": "OUTCOME_TRAFFIC",
                "status": "PAUSED",
                "ad_account_id": "act_test123",
            }
            response = await client.post("/api/campaigns", json=payload, headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["campaign"]["name"] == "Test Kampanya"

    async def test_create_campaign_missing_account_id_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ):
        import app.config as cfg
        original = cfg.get_setting("META_AD_ACCOUNT_ID")
        # Config'deki varsayılan hesabı temizle
        with patch("app.routers.campaigns.config.get_setting", return_value=None):
            payload = {"name": "Test", "objective": "OUTCOME_TRAFFIC"}
            response = await client.post("/api/campaigns", json=payload, headers=auth_headers)
        assert response.status_code == 400


class TestUpdateCampaignStatusEndpoint:
    async def test_update_status_requires_auth(self, client: AsyncClient):
        response = await client.patch(
            "/api/campaigns/camp_001/status",
            json={"status": "PAUSED"},
        )
        assert response.status_code == 401

    async def test_update_status_success(
        self, client: AsyncClient, auth_headers: dict
    ):
        with patch(
            "app.services.meta_service.MetaAdsService.update_campaign_status",
            new_callable=AsyncMock,
            return_value={"success": True},
        ):
            response = await client.patch(
                "/api/campaigns/camp_001/status",
                json={"status": "PAUSED"},
                headers=auth_headers,
            )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["campaign_id"] == "camp_001"
        assert body["status"] == "PAUSED"
