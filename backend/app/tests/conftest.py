# -*- coding: utf-8 -*-
"""Pytest fixtures and configuration for Meta Ads Dashboard tests."""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.main import app
from app.database import get_session
from app.models import Base, User
from app.auth import create_access_token, hash_password

# Test database URL - uses SQLite for simplicity in initial tests
# For PostgreSQL tests, use: postgresql+asyncpg://metaads:metaads@localhost:5432/metaads_test
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", 
    "postgresql+asyncpg://metaads:metaads@localhost:5432/metaads_test"
)

# Test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    poolclass=NullPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def test_db_setup():
    """Setup test database - create all tables."""
    try:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        yield
    except Exception as e:
        pytest.skip(f"Test database not available: {e}")
    finally:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(test_db_setup) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async with TestSessionLocal() as session:
        yield session
        # Cleanup: rollback and close
        await session.rollback()
        await session.close()


@pytest.fixture
def override_get_session(db_session):
    """Override FastAPI dependency to use test session."""
    async def _get_session():
        yield db_session
    
    app.dependency_overrides[get_session] = _get_session
    yield
    # Cleanup: remove override
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client(override_get_session) -> AsyncGenerator[AsyncClient, None]:
    """Create async HTTP client for API testing."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user with admin role."""
    user = User(
        id=str(uuid.uuid4()),
        email="test@example.com",
        username="testuser",
        hashed_password=hash_password("testpass123"),
        role="admin",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_manager(db_session: AsyncSession) -> User:
    """Create a test user with manager role."""
    user = User(
        id=str(uuid.uuid4()),
        email="manager@example.com",
        username="testmanager",
        hashed_password=hash_password("manager123"),
        role="manager",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_viewer(db_session: AsyncSession) -> User:
    """Create a test user with viewer role."""
    user = User(
        id=str(uuid.uuid4()),
        email="viewer@example.com",
        username="testviewer",
        hashed_password=hash_password("viewer123"),
        role="viewer",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def inactive_user(db_session: AsyncSession) -> User:
    """Create an inactive test user."""
    user = User(
        id=str(uuid.uuid4()),
        email="inactive@example.com",
        username="inactiveuser",
        hashed_password=hash_password("inactive123"),
        role="viewer",
        is_active=False,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User) -> dict:
    """Generate authorization headers for test user."""
    token = create_access_token(
        sub=test_user.id,
        email=test_user.email,
        role=test_user.role,
        username=test_user.username
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def manager_auth_headers(test_manager: User) -> dict:
    """Generate authorization headers for manager user."""
    token = create_access_token(
        sub=test_manager.id,
        email=test_manager.email,
        role=test_manager.role,
        username=test_manager.username
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def viewer_auth_headers(test_viewer: User) -> dict:
    """Generate authorization headers for viewer user."""
    token = create_access_token(
        sub=test_viewer.id,
        email=test_viewer.email,
        role=test_viewer.role,
        username=test_viewer.username
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def inactive_auth_headers(inactive_user: User) -> dict:
    """Generate authorization headers for inactive user."""
    token = create_access_token(
        sub=inactive_user.id,
        email=inactive_user.email,
        role=inactive_user.role,
        username=inactive_user.username
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def expired_token() -> str:
    """Generate an expired JWT token."""
    from jose import jwt
    from app.auth import JWT_SECRET, JWT_ALGORITHM
    
    # Create token that expired 1 hour ago
    expired_time = datetime.now(timezone.utc) - timedelta(hours=1)
    iat = expired_time - timedelta(minutes=10)
    
    to_encode = {
        "sub": str(uuid.uuid4()),
        "email": "expired@example.com",
        "role": "viewer",
        "username": "expireduser",
        "exp": expired_time,
        "iat": iat,
    }
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


@pytest.fixture
def invalid_auth_headers(expired_token: str) -> dict:
    """Generate authorization headers with expired token."""
    return {"Authorization": f"Bearer {expired_token}"}
