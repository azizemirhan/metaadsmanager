# -*- coding: utf-8 -*-
"""Integration tests for authentication API endpoints."""

import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.auth import hash_password


class TestRegisterEndpoint:
    """Tests for POST /api/auth/register endpoint."""
    
    async def test_register_success(self, async_client: AsyncClient):
        """Successful user registration."""
        response = await async_client.post("/api/auth/register", json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "securepassword123",
        })

        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        user = data["user"]
        assert user["email"] == "newuser@example.com"
        assert user["username"] == "newuser"
        assert "id" in user
        assert "hashed_password" not in user
        assert user["role"] in ("admin", "viewer")  # First user=admin, rest=viewer
        assert "access_token" in data
    
    async def test_register_duplicate_email(
        self, 
        async_client: AsyncClient, 
        db_session: AsyncSession,
        test_user: User
    ):
        """Registration with duplicate email should fail."""
        response = await async_client.post("/api/auth/register", json={
            "email": test_user.email,  # Same email as test_user
            "username": "differentuser",
            "password": "password123",
        })
        
        assert response.status_code == 400
        assert "e-posta" in response.json()["detail"].lower() or "email" in response.json()["detail"].lower()
    
    async def test_register_invalid_email_format(self, async_client: AsyncClient):
        """Registration with invalid email format should fail."""
        response = await async_client.post("/api/auth/register", json={
            "email": "not-an-email",
            "username": "newuser",
            "password": "password123",
        })
        
        assert response.status_code == 422  # Validation error
    
    async def test_register_short_password(self, async_client: AsyncClient):
        """Registration with short password should fail."""
        response = await async_client.post("/api/auth/register", json={
            "email": "new@example.com",
            "username": "newuser",
            "password": "123",  # Too short
        })

        assert response.status_code == 400
    
    async def test_register_missing_fields(self, async_client: AsyncClient):
        """Registration with missing fields should fail."""
        # Missing email
        response = await async_client.post("/api/auth/register", json={
            "username": "newuser",
            "password": "password123",
        })
        assert response.status_code == 422
        
        # Missing username
        response = await async_client.post("/api/auth/register", json={
            "email": "new@example.com",
            "password": "password123",
        })
        assert response.status_code == 422
        
        # Missing password
        response = await async_client.post("/api/auth/register", json={
            "email": "new@example.com",
            "username": "newuser",
        })
        assert response.status_code == 422
    
    async def test_register_empty_body(self, async_client: AsyncClient):
        """Registration with empty body should fail."""
        response = await async_client.post("/api/auth/register", json={})
        assert response.status_code == 422


class TestLoginEndpoint:
    """Tests for POST /api/auth/login endpoint."""
    
    async def test_login_success(
        self, 
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Successful login with valid credentials."""
        # Create a user first
        user = User(
            id=str(uuid.uuid4()),
            email="login@example.com",
            username="logintest",
            hashed_password=hash_password("testpass123"),
            role="admin",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()
        
        response = await async_client.post("/api/auth/login", json={
            "email": "login@example.com",
            "password": "testpass123",
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == "login@example.com"
    
    async def test_login_wrong_password(
        self, 
        async_client: AsyncClient,
        test_user: User
    ):
        """Login with wrong password should fail."""
        response = await async_client.post("/api/auth/login", json={
            "email": test_user.email,
            "password": "wrongpassword",
        })
        
        assert response.status_code == 401
        assert "geçersiz" in response.json()["detail"].lower() or "invalid" in response.json()["detail"].lower()
    
    async def test_login_nonexistent_user(self, async_client: AsyncClient):
        """Login with non-existent user should fail."""
        response = await async_client.post("/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "somepassword",
        })
        
        assert response.status_code == 401
    
    async def test_login_inactive_user(
        self,
        async_client: AsyncClient,
        inactive_user: User
    ):
        """Login with inactive user account should fail."""
        response = await async_client.post("/api/auth/login", json={
            "email": inactive_user.email,
            "password": "inactive123",
        })
        
        assert response.status_code == 403  # Inactive user returns 403
        assert "devre" in response.json()["detail"].lower() or "active" in response.json()["detail"].lower() or "disabled" in response.json()["detail"].lower()


class TestGetMeEndpoint:
    """Tests for GET /api/auth/me endpoint."""
    
    async def test_get_me_success(
        self, 
        async_client: AsyncClient,
        test_user: User,
        auth_headers: dict
    ):
        """Get current user info with valid token."""
        response = await async_client.get("/api/auth/me", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_user.id
        assert data["email"] == test_user.email
        assert data["username"] == test_user.username
        assert data["role"] == test_user.role
        assert "hashed_password" not in data
    
    async def test_get_me_no_token(self, async_client: AsyncClient):
        """Get user info without token should fail."""
        response = await async_client.get("/api/auth/me")
        
        assert response.status_code == 401
        assert "giriş" in response.json()["detail"].lower() or "login" in response.json()["detail"].lower()
    
    async def test_get_me_invalid_token(self, async_client: AsyncClient):
        """Get user info with invalid token should fail."""
        response = await async_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        
        assert response.status_code == 401
    
    async def test_get_me_expired_token(
        self,
        async_client: AsyncClient,
        invalid_auth_headers: dict
    ):
        """Get user info with expired token should fail."""
        response = await async_client.get("/api/auth/me", headers=invalid_auth_headers)
        
        assert response.status_code == 401
        assert "süresi" in response.json()["detail"].lower() or "expired" in response.json()["detail"].lower()
    
    async def test_get_me_inactive_user(
        self,
        async_client: AsyncClient,
        inactive_user: User
    ):
        """Get user info for inactive user should fail."""
        from app.auth import create_access_token
        token = create_access_token(
            sub=inactive_user.id,
            email=inactive_user.email,
            role=inactive_user.role,
            username=inactive_user.username
        )
        headers = {"Authorization": f"Bearer {token}"}
        
        response = await async_client.get("/api/auth/me", headers=headers)
        
        assert response.status_code == 403
        assert "devre dışı" in response.json()["detail"].lower() or "disabled" in response.json()["detail"].lower()
    
    async def test_get_me_deleted_user(
        self,
        async_client: AsyncClient,
        db_session: AsyncSession
    ):
        """Get user info for deleted (non-existent) user should fail."""
        from app.auth import create_access_token
        # Create token for non-existent user
        fake_user_id = str(uuid.uuid4())
        token = create_access_token(
            sub=fake_user_id,
            email="fake@example.com",
            role="viewer",
            username="fakeuser"
        )
        headers = {"Authorization": f"Bearer {token}"}
        
        response = await async_client.get("/api/auth/me", headers=headers)
        
        assert response.status_code == 401
        assert "bulunamadı" in response.json()["detail"].lower() or "not found" in response.json()["detail"].lower()


class TestAuthEdgeCases:
    """Edge case tests for authentication."""
    
    async def test_malformed_auth_header(self, async_client: AsyncClient):
        """Malformed authorization header should fail gracefully."""
        response = await async_client.get(
            "/api/auth/me",
            headers={"Authorization": "NotBearer token123"}
        )
        assert response.status_code == 401
    
    async def test_auth_header_without_bearer(self, async_client: AsyncClient):
        """Auth header without 'Bearer' prefix should fail."""
        response = await async_client.get(
            "/api/auth/me",
            headers={"Authorization": "just_a_token"}
        )
        assert response.status_code == 401
    
    async def test_auth_header_with_empty_token(self, async_client: AsyncClient):
        """Auth header with empty token should fail."""
        response = await async_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer "}
        )
        assert response.status_code == 401
    
    async def test_case_sensitive_email_login(
        self,
        async_client: AsyncClient,
        test_user: User
    ):
        """Email case sensitivity test for login."""
        # Try with different case
        response = await async_client.post("/api/auth/login", json={
            "email": test_user.email.upper(),
            "password": "testpass123",
        })
        
        # Should either succeed (case insensitive) or fail with 401
        assert response.status_code in [200, 401]
