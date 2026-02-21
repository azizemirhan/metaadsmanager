# -*- coding: utf-8 -*-
"""Redis cache yönetimi - API performans optimizasyonu."""

import json
import pickle
from functools import wraps
from typing import Any, Optional, Callable

import redis
from app import config

# Redis client (lazy initialization)
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> Optional[redis.Redis]:
    """Redis client singleton."""
    global _redis_client
    if _redis_client is None and config.CACHE_ENABLED:
        try:
            _redis_client = redis.from_url(
                config.REDIS_URL,
                decode_responses=False,  # Binary data için
                socket_connect_timeout=5,
                socket_timeout=5,
            )
            # Bağlantıyı test et
            _redis_client.ping()
        except Exception as e:
            print(f"Redis bağlantı hatası: {e}")
            _redis_client = None
    return _redis_client


def cache_key(prefix: str, *args, **kwargs) -> str:
    """Cache key oluştur."""
    key_parts = [prefix]
    if args:
        key_parts.append(str(args))
    if kwargs:
        key_parts.append(str(sorted(kwargs.items())))
    return ":".join(key_parts)


def cached(
    prefix: str,
    ttl: Optional[int] = None,
    key_func: Optional[Callable] = None
):
    """Decorator - Fonksiyon sonucunu cache'le.
    
    Usage:
        @cached("campaigns", ttl=300)
        async def get_campaigns(days: int = 30):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            if not config.CACHE_ENABLED:
                return await func(*args, **kwargs)
            
            client = get_redis_client()
            if not client:
                return await func(*args, **kwargs)
            
            # Cache key oluştur
            if key_func:
                key = key_func(*args, **kwargs)
            else:
                key = cache_key(prefix, *args, **kwargs)
            
            # Cache'den oku
            try:
                cached_data = client.get(key)
                if cached_data:
                    return pickle.loads(cached_data)
            except Exception as e:
                print(f"Cache read error: {e}")
            
            # Fonksiyonu çalıştır
            result = await func(*args, **kwargs)
            
            # Cache'e yaz
            try:
                cache_ttl = ttl or config.CACHE_TTL
                client.setex(key, cache_ttl, pickle.dumps(result))
            except Exception as e:
                print(f"Cache write error: {e}")
            
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if not config.CACHE_ENABLED:
                return func(*args, **kwargs)
            
            client = get_redis_client()
            if not client:
                return func(*args, **kwargs)
            
            # Cache key oluştur
            if key_func:
                key = key_func(*args, **kwargs)
            else:
                key = cache_key(prefix, *args, **kwargs)
            
            # Cache'den oku
            try:
                cached_data = client.get(key)
                if cached_data:
                    return pickle.loads(cached_data)
            except Exception as e:
                print(f"Cache read error: {e}")
            
            # Fonksiyonu çalıştır
            result = func(*args, **kwargs)
            
            # Cache'e yaz
            try:
                cache_ttl = ttl or config.CACHE_TTL
                client.setex(key, cache_ttl, pickle.dumps(result))
            except Exception as e:
                print(f"Cache write error: {e}")
            
            return result
        
        # Async mi sync mi olduğunu kontrol et
        import asyncio
        if asyncio.iscoroutinefunction(func):
            wrapper = async_wrapper
        else:
            wrapper = sync_wrapper
        
        # Cache invalidate fonksiyonu ekle
        wrapper.invalidate = lambda *a, **kw: invalidate_cache(
            key_func(*a, **kw) if key_func else cache_key(prefix, *a, **kw)
        )
        
        return wrapper
    return decorator


def invalidate_cache(pattern: str) -> int:
    """Pattern'e uyan cache key'leri sil.
    
    Returns:
        Silinen key sayısı
    """
    client = get_redis_client()
    if not client:
        return 0
    
    try:
        keys = client.scan_iter(match=pattern)
        count = 0
        for key in keys:
            client.delete(key)
            count += 1
        return count
    except Exception as e:
        print(f"Cache invalidate error: {e}")
        return 0


def invalidate_prefix(prefix: str) -> int:
    """Prefix ile başlayan tüm cache'leri sil."""
    return invalidate_cache(f"{prefix}:*")


def clear_all_cache() -> bool:
    """Tüm cache'i temizle."""
    client = get_redis_client()
    if not client:
        return False
    
    try:
        client.flushdb()
        return True
    except Exception as e:
        print(f"Cache clear error: {e}")
        return False


def get_cache_stats() -> dict:
    """Cache istatistikleri."""
    client = get_redis_client()
    if not client:
        return {"enabled": False}
    
    try:
        info = client.info()
        return {
            "enabled": True,
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "hit_rate": (
                info.get("keyspace_hits", 0) / 
                (info.get("keyspace_hits", 0) + info.get("keyspace_misses", 1))
            ) * 100,
            "keys": client.dbsize(),
            "memory_used": info.get("used_memory_human", "N/A"),
        }
    except Exception as e:
        return {"enabled": True, "error": str(e)}


class CacheManager:
    """Context manager ile cache yönetimi."""
    
    def __init__(self, prefix: str, ttl: Optional[int] = None):
        self.prefix = prefix
        self.ttl = ttl or config.CACHE_TTL
        self.client = get_redis_client()
    
    def get(self, key: str) -> Optional[Any]:
        """Cache'den veri al."""
        if not self.client:
            return None
        try:
            data = self.client.get(f"{self.prefix}:{key}")
            return pickle.loads(data) if data else None
        except Exception:
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Cache'e veri yaz."""
        if not self.client:
            return False
        try:
            cache_ttl = ttl or self.ttl
            self.client.setex(
                f"{self.prefix}:{key}",
                cache_ttl,
                pickle.dumps(value)
            )
            return True
        except Exception:
            return False
    
    def delete(self, key: str) -> bool:
        """Cache'den veri sil."""
        if not self.client:
            return False
        try:
            self.client.delete(f"{self.prefix}:{key}")
            return True
        except Exception:
            return False
    
    def clear(self) -> int:
        """Bu prefix ile ilgili tüm cache'i temizle."""
        return invalidate_prefix(self.prefix)
