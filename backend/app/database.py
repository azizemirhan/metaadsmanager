# -*- coding: utf-8 -*-
"""PostgreSQL async bağlantı ve oturum yönetimi."""

import logging
from typing import AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app import config
from app.models import Base

logger = logging.getLogger(__name__)

# DATABASE_URL örnek: postgresql+asyncpg://user:pass@host:5432/dbname
# Sync URL verilirse asyncpg için dönüştür
def _get_async_url() -> str:
    url = (config.DATABASE_URL or "").strip()
    if not url:
        return ""
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


_async_url = _get_async_url()
engine = None
async_session_factory = None

if _async_url:
    try:
        engine = create_async_engine(
            _async_url,
            echo=False,
            pool_pre_ping=True,
            poolclass=NullPool,
        )
        async_session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    except Exception as e:
        logger.warning("PostgreSQL engine oluşturulamadı: %s", e)
        engine = None
        async_session_factory = None


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI Depends ile kullanılacak async session."""
    if not async_session_factory:
        raise RuntimeError("DATABASE_URL tanımlı değil; PostgreSQL kullanılamıyor.")
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_session_optional() -> AsyncGenerator[Optional[AsyncSession], None]:
    """Session döndürür; DATABASE_URL yoksa None. Rapor router'ında kullanılır."""
    if not async_session_factory:
        yield None
        return
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Tüm tabloları oluşturur. Uygulama başlarken çağrılır."""
    if not engine:
        return
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("PostgreSQL tabloları hazır.")
    except Exception as e:
        logger.exception("PostgreSQL init_db hatası: %s", e)
        raise


def is_db_configured() -> bool:
    """PostgreSQL kullanılabiliyor mu?"""
    return bool(async_session_factory)
