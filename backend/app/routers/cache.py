# -*- coding: utf-8 -*-
"""Cache yönetimi API endpoint'leri."""

from fastapi import APIRouter, Depends
from typing import Optional

from app.cache import get_cache_stats, clear_all_cache, invalidate_prefix
from app.deps import RequireAdmin

router = APIRouter()


@router.get("/stats")
async def get_cache_statistics(
    current_user: RequireAdmin
):
    """Cache istatistiklerini görüntüle (sadece admin)."""
    return get_cache_stats()


@router.post("/clear")
async def clear_cache(
    prefix: Optional[str] = None,
    current_user: RequireAdmin = None
):
    """Cache'i temizle (sadece admin).
    
    Args:
        prefix: Belirli bir prefix'i temizle (örn: "campaigns")
              None ise tüm cache temizlenir.
    """
    if prefix:
        deleted_count = invalidate_prefix(prefix)
        return {
            "message": f"'{prefix}' prefix ile başlayan cache temizlendi",
            "deleted_keys": deleted_count
        }
    else:
        success = clear_all_cache()
        return {
            "message": "Tüm cache temizlendi",
            "success": success
        }


@router.post("/invalidate/campaigns")
async def invalidate_campaigns_cache(
    current_user: RequireAdmin
):
    """Kampanya cache'ini temizle (sadece admin)."""
    deleted_count = invalidate_prefix("campaigns")
    return {
        "message": "Kampanya cache'i temizlendi",
        "deleted_keys": deleted_count
    }
