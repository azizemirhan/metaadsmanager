# -*- coding: utf-8 -*-
"""
Test fixtures: SQLite in-memory DB, async test client, auth token yardımcıları.
PostgreSQL gerektirmez — CI/CD'de bağımsız çalışır.
"""
import os
import pytest
import pytest_asyncio
from typing import AsyncGenerator

# Test ortamı için sahte env değerleri (gerçek DB/API gerektirmez)
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unit-tests-only")
os.environ.setdefault("META_ACCESS_TOKEN", "test-token")
os.environ.setdefault("META_AD_ACCOUNT_ID", "act_test123")

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from httpx import AsyncClient, ASGITransport

from app.models import Base, User
from app.auth import hash_password, create_access_token
from app.main import app
from app.database import get_session

# ─── In-memory SQLite engine ───────────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionFactory = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Session başında tabloları oluştur, sonunda düşür."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Her test için ayrı, rollback yapılan oturum."""
    async with TestSessionFactory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI test istemcisi; gerçek DB yerine in-memory SQLite kullanır."""

    async def _override_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_session
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


# ─── Kullanıcı & token yardımcıları ────────────────────────────────────────────

async def _create_user(
    session: AsyncSession,
    email: str = "test@example.com",
    username: str = "testuser",
    role: str = "admin",
    password: str = "testpass123",
) -> User:
    import uuid
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        username=username,
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
    )
    session.add(user)
    await session.commit()
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    return await _create_user(db_session, email="admin@example.com", role="admin")


@pytest_asyncio.fixture
async def viewer_user(db_session: AsyncSession) -> User:
    return await _create_user(db_session, email="viewer@example.com", role="viewer")


@pytest.fixture
def admin_token(admin_user: User) -> str:
    return create_access_token(
        sub=admin_user.id,
        email=admin_user.email,
        role=admin_user.role,
        username=admin_user.username,
    )


@pytest.fixture
def viewer_token(viewer_user: User) -> str:
    return create_access_token(
        sub=viewer_user.id,
        email=viewer_user.email,
        role=viewer_user.role,
        username=viewer_user.username,
    )


@pytest.fixture
def auth_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def viewer_headers(viewer_token: str) -> dict:
    return {"Authorization": f"Bearer {viewer_token}"}
