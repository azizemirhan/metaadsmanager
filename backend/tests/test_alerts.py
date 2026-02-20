# -*- coding: utf-8 -*-
"""
Alert Rules API entegrasyon testleri.
In-memory SQLite üzerinde çalışır; Meta API çağrısı yapmaz.
"""
import pytest
from httpx import AsyncClient


class TestAlertRulesListEndpoint:
    async def test_list_rules_returns_200(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/alerts/rules", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert "count" in body
        assert isinstance(body["data"], list)

    async def test_list_rules_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/alerts/rules")
        assert response.status_code == 401

    async def test_list_rules_empty_by_default(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/alerts/rules", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["count"] == 0


class TestAlertRulesCreateEndpoint:
    async def test_create_valid_rule(self, client: AsyncClient, auth_headers: dict):
        payload = {
            "name": "Düşük CTR Uyarısı",
            "metric": "ctr",
            "condition": "lt",
            "threshold": 1.5,
            "channels": ["email"],
            "email_to": "test@example.com",
            "cooldown_minutes": 60,
        }
        response = await client.post("/api/alerts/rules", json=payload, headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["data"]["name"] == "Düşük CTR Uyarısı"
        assert body["data"]["metric"] == "ctr"
        assert body["data"]["condition"] == "lt"
        assert body["data"]["threshold"] == 1.5
        assert body["data"]["is_active"] is True
        assert "id" in body["data"]

    async def test_create_rule_requires_auth(self, client: AsyncClient):
        payload = {"name": "Test", "metric": "ctr", "condition": "lt", "threshold": 1.0}
        response = await client.post("/api/alerts/rules", json=payload)
        assert response.status_code == 401

    async def test_create_rule_invalid_metric(self, client: AsyncClient, auth_headers: dict):
        payload = {
            "name": "Geçersiz Metrik",
            "metric": "invalid_metric",
            "condition": "lt",
            "threshold": 1.0,
        }
        response = await client.post("/api/alerts/rules", json=payload, headers=auth_headers)
        assert response.status_code == 422  # Validation error

    async def test_create_rule_invalid_condition(self, client: AsyncClient, auth_headers: dict):
        payload = {
            "name": "Geçersiz Koşul",
            "metric": "ctr",
            "condition": "invalid_condition",
            "threshold": 1.0,
        }
        response = await client.post("/api/alerts/rules", json=payload, headers=auth_headers)
        assert response.status_code == 422

    async def test_create_rule_negative_threshold_fails(self, client: AsyncClient, auth_headers: dict):
        payload = {
            "name": "Negatif Eşik",
            "metric": "ctr",
            "condition": "lt",
            "threshold": -1.0,
        }
        response = await client.post("/api/alerts/rules", json=payload, headers=auth_headers)
        assert response.status_code == 422

    async def test_create_all_valid_metrics(self, client: AsyncClient, auth_headers: dict):
        valid_metrics = ["ctr", "roas", "spend", "cpc", "cpm", "impressions", "clicks", "frequency"]
        for metric in valid_metrics:
            payload = {
                "name": f"{metric} kuralı",
                "metric": metric,
                "condition": "gt",
                "threshold": 100.0,
            }
            response = await client.post("/api/alerts/rules", json=payload, headers=auth_headers)
            assert response.status_code == 200, f"{metric} metriği başarısız oldu"


class TestAlertRulesGetEndpoint:
    async def test_get_existing_rule(self, client: AsyncClient, auth_headers: dict):
        # Önce kural oluştur
        create_resp = await client.post(
            "/api/alerts/rules",
            json={"name": "Test Kural", "metric": "roas", "condition": "lt", "threshold": 2.0},
            headers=auth_headers,
        )
        rule_id = create_resp.json()["data"]["id"]

        # Sonra getir
        response = await client.get(f"/api/alerts/rules/{rule_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["data"]["id"] == rule_id

    async def test_get_nonexistent_rule_returns_404(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/alerts/rules/nonexistent-id", headers=auth_headers)
        assert response.status_code == 404


class TestAlertRulesUpdateEndpoint:
    async def test_update_rule_name(self, client: AsyncClient, auth_headers: dict):
        create_resp = await client.post(
            "/api/alerts/rules",
            json={"name": "Eski Ad", "metric": "spend", "condition": "gt", "threshold": 500.0},
            headers=auth_headers,
        )
        rule_id = create_resp.json()["data"]["id"]

        response = await client.put(
            f"/api/alerts/rules/{rule_id}",
            json={"name": "Yeni Ad"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["data"]["name"] == "Yeni Ad"

    async def test_update_rule_active_status(self, client: AsyncClient, auth_headers: dict):
        create_resp = await client.post(
            "/api/alerts/rules",
            json={"name": "Durum Testi", "metric": "cpc", "condition": "gt", "threshold": 5.0},
            headers=auth_headers,
        )
        rule_id = create_resp.json()["data"]["id"]

        response = await client.put(
            f"/api/alerts/rules/{rule_id}",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["data"]["is_active"] is False

    async def test_update_nonexistent_rule_returns_404(self, client: AsyncClient, auth_headers: dict):
        response = await client.put(
            "/api/alerts/rules/nonexistent",
            json={"name": "Yeni Ad"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestAlertRulesDeleteEndpoint:
    async def test_delete_existing_rule(self, client: AsyncClient, auth_headers: dict):
        create_resp = await client.post(
            "/api/alerts/rules",
            json={"name": "Silinecek Kural", "metric": "cpm", "condition": "gt", "threshold": 20.0},
            headers=auth_headers,
        )
        rule_id = create_resp.json()["data"]["id"]

        response = await client.delete(f"/api/alerts/rules/{rule_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["success"] is True

        # Artık bulunamaz
        get_resp = await client.get(f"/api/alerts/rules/{rule_id}", headers=auth_headers)
        assert get_resp.status_code == 404

    async def test_delete_nonexistent_rule_returns_404(self, client: AsyncClient, auth_headers: dict):
        response = await client.delete("/api/alerts/rules/nonexistent", headers=auth_headers)
        assert response.status_code == 404


class TestAlertRulesToggleEndpoint:
    async def test_toggle_deactivates_active_rule(self, client: AsyncClient, auth_headers: dict):
        create_resp = await client.post(
            "/api/alerts/rules",
            json={"name": "Toggle Testi", "metric": "ctr", "condition": "lt", "threshold": 1.0},
            headers=auth_headers,
        )
        rule_id = create_resp.json()["data"]["id"]
        assert create_resp.json()["data"]["is_active"] is True

        response = await client.post(f"/api/alerts/rules/{rule_id}/toggle", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["is_active"] is False

    async def test_toggle_twice_restores_active(self, client: AsyncClient, auth_headers: dict):
        create_resp = await client.post(
            "/api/alerts/rules",
            json={"name": "Çift Toggle", "metric": "roas", "condition": "lt", "threshold": 2.0},
            headers=auth_headers,
        )
        rule_id = create_resp.json()["data"]["id"]

        await client.post(f"/api/alerts/rules/{rule_id}/toggle", headers=auth_headers)
        second_resp = await client.post(f"/api/alerts/rules/{rule_id}/toggle", headers=auth_headers)
        assert second_resp.json()["is_active"] is True


class TestAlertMetricsEndpoint:
    async def test_metrics_endpoint_returns_all_metrics(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/alerts/metrics", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert "metrics" in body
        assert "conditions" in body
        assert "channels" in body
        metric_ids = [m["id"] for m in body["metrics"]]
        assert "ctr" in metric_ids
        assert "roas" in metric_ids
        assert "spend" in metric_ids

    async def test_history_endpoint_returns_list(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/alerts/history", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert isinstance(body["data"], list)
