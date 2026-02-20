# -*- coding: utf-8 -*-
"""Güvenlik: 2FA (TOTP), API anahtarları ve denetim kaydı."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import struct
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.deps import CurrentUser, RequireAdmin
from app.models import (
    APIKey, AuditLog, User, UserTwoFA,
    api_key_to_dict, audit_log_to_dict,
)

router = APIRouter(prefix="/api/security", tags=["Security"])


# ─── TOTP helpers (stdlib only – no pyotp needed) ────────────────────────────

def _totp_secret() -> str:
    return base64.b32encode(os.urandom(20)).decode("utf-8")


def _totp_code(secret: str, counter: int) -> str:
    key = base64.b32decode(secret.upper())
    msg = struct.pack(">Q", counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = struct.unpack(">I", h[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % 1_000_000).zfill(6)


def _verify_totp(secret: str, code: str, window: int = 1) -> bool:
    now = int(time.time()) // 30
    for delta in range(-window, window + 1):
        if _totp_code(secret, now + delta) == code.strip():
            return True
    return False


def _totp_uri(secret: str, email: str, issuer: str = "Meta Ads Manager") -> str:
    return (
        f"otpauth://totp/{quote(issuer)}:{quote(email)}"
        f"?secret={secret}&issuer={quote(issuer)}&digits=6&period=30"
    )


# ─── API Key helpers ─────────────────────────────────────────────────────────

def _generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, hashed_key, prefix)."""
    raw = "mam_" + secrets.token_urlsafe(32)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    prefix = raw[:12]
    return raw, hashed, prefix


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ─── Audit helper ────────────────────────────────────────────────────────────

async def log_action(
    session: AsyncSession,
    user: User,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    details: dict | None = None,
    ip: str | None = None,
) -> None:
    entry = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        user_email=user.email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip,
    )
    session.add(entry)


# ══════════════════════════════════════════════════════════════════════════════
# 2FA Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/2fa/status")
async def twofa_status(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Kullanıcının 2FA durumunu döner."""
    result = await session.execute(
        select(UserTwoFA).where(UserTwoFA.user_id == current_user.id)
    )
    twofa = result.scalar_one_or_none()
    return {
        "enabled": twofa.is_enabled if twofa else False,
        "configured": twofa is not None,
    }


@router.post("/2fa/setup")
async def twofa_setup(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """2FA kurulumu için yeni TOTP secret ve QR URI üretir."""
    result = await session.execute(
        select(UserTwoFA).where(UserTwoFA.user_id == current_user.id)
    )
    twofa = result.scalar_one_or_none()
    if twofa and twofa.is_enabled:
        raise HTTPException(status_code=400, detail="2FA zaten etkin. Önce devre dışı bırakın.")

    secret = _totp_secret()
    if twofa:
        twofa.secret = secret
        twofa.updated_at = datetime.now(timezone.utc)
    else:
        twofa = UserTwoFA(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            secret=secret,
            is_enabled=False,
        )
        session.add(twofa)

    await session.flush()
    uri = _totp_uri(secret, current_user.email)
    return {
        "secret": secret,
        "uri": uri,
        "message": "Google Authenticator veya uyumlu uygulamaya bu kodu ekleyin, ardından /2fa/enable ile doğrulayın.",
    }


class VerifyBody(BaseModel):
    code: str


@router.post("/2fa/enable")
async def twofa_enable(
    body: VerifyBody,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """TOTP kodu doğrulayıp 2FA'yı etkinleştirir."""
    result = await session.execute(
        select(UserTwoFA).where(UserTwoFA.user_id == current_user.id)
    )
    twofa = result.scalar_one_or_none()
    if not twofa:
        raise HTTPException(status_code=400, detail="Önce /2fa/setup ile kurulum yapın.")
    if twofa.is_enabled:
        raise HTTPException(status_code=400, detail="2FA zaten etkin.")
    if not _verify_totp(twofa.secret, body.code):
        raise HTTPException(status_code=400, detail="Geçersiz TOTP kodu.")

    # 8 yedek kod üret
    backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    backup_hashes = [hashlib.sha256(c.encode()).hexdigest() for c in backup_codes]

    twofa.is_enabled = True
    twofa.backup_codes = backup_hashes
    twofa.updated_at = datetime.now(timezone.utc)
    await log_action(session, current_user, "security.2fa_enabled")
    await session.flush()
    return {
        "success": True,
        "message": "2FA etkinleştirildi.",
        "backup_codes": backup_codes,
    }


@router.post("/2fa/disable")
async def twofa_disable(
    body: VerifyBody,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """TOTP kodu doğrulayıp 2FA'yı devre dışı bırakır."""
    result = await session.execute(
        select(UserTwoFA).where(UserTwoFA.user_id == current_user.id)
    )
    twofa = result.scalar_one_or_none()
    if not twofa or not twofa.is_enabled:
        raise HTTPException(status_code=400, detail="2FA zaten devre dışı.")
    if not _verify_totp(twofa.secret, body.code):
        raise HTTPException(status_code=400, detail="Geçersiz TOTP kodu.")

    twofa.is_enabled = False
    twofa.backup_codes = None
    twofa.updated_at = datetime.now(timezone.utc)
    await log_action(session, current_user, "security.2fa_disabled")
    await session.flush()
    return {"success": True, "message": "2FA devre dışı bırakıldı."}


@router.post("/2fa/verify")
async def twofa_verify(body: VerifyBody, current_user: CurrentUser, session: AsyncSession = Depends(get_session)):
    """Mevcut TOTP kodunu doğrular (ön-yüz test amaçlı)."""
    result = await session.execute(select(UserTwoFA).where(UserTwoFA.user_id == current_user.id))
    twofa = result.scalar_one_or_none()
    if not twofa or not twofa.is_enabled:
        raise HTTPException(status_code=400, detail="2FA etkin değil.")
    valid = _verify_totp(twofa.secret, body.code)
    if not valid and twofa.backup_codes:
        code_hash = hashlib.sha256(body.code.strip().upper().encode()).hexdigest()
        if code_hash in twofa.backup_codes:
            twofa.backup_codes = [c for c in twofa.backup_codes if c != code_hash]
            await session.flush()
            valid = True
    return {"valid": valid}


# ══════════════════════════════════════════════════════════════════════════════
# API Key Endpoints
# ══════════════════════════════════════════════════════════════════════════════

class APIKeyCreate(BaseModel):
    name: str
    expires_days: Optional[int] = None  # None = süresiz


@router.get("/api-keys")
async def list_api_keys(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(APIKey).where(APIKey.user_id == current_user.id).order_by(desc(APIKey.created_at))
    )
    keys = result.scalars().all()
    return {"data": [api_key_to_dict(k) for k in keys], "count": len(keys)}


@router.post("/api-keys")
async def create_api_key(
    body: APIKeyCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Anahtar adı boş olamaz.")
    raw, hashed, prefix = _generate_api_key()
    expires_at = None
    if body.expires_days and body.expires_days > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days)

    key = APIKey(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=body.name.strip(),
        key_hash=hashed,
        key_prefix=prefix,
        is_active=True,
        expires_at=expires_at,
    )
    session.add(key)
    await log_action(session, current_user, "security.api_key_created", "api_key", key.id, {"name": body.name})
    await session.flush()
    return {"success": True, "data": api_key_to_dict(key, show_full=raw), "message": "Anahtar yalnızca bir kez gösterilir."}


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="Anahtar bulunamadı.")
    key.is_active = False
    await log_action(session, current_user, "security.api_key_revoked", "api_key", key_id)
    await session.flush()
    return {"success": True, "message": "Anahtar iptal edildi."}


@router.post("/api-keys/{key_id}/rotate")
async def rotate_api_key(
    key_id: str,
    body: APIKeyCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
):
    """Mevcut anahtarı iptal edip aynı ayarlarla yeni bir tane oluşturur."""
    result = await session.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id)
    )
    old_key = result.scalar_one_or_none()
    if not old_key:
        raise HTTPException(status_code=404, detail="Anahtar bulunamadı.")
    old_key.is_active = False

    raw, hashed, prefix = _generate_api_key()
    expires_at = None
    if body.expires_days and body.expires_days > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_days)

    new_key = APIKey(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=body.name.strip() or old_key.name,
        key_hash=hashed,
        key_prefix=prefix,
        is_active=True,
        expires_at=expires_at,
    )
    session.add(new_key)
    await log_action(session, current_user, "security.api_key_rotated", "api_key", key_id, {"new_id": new_key.id})
    await session.flush()
    return {"success": True, "data": api_key_to_dict(new_key, show_full=raw), "old_key_id": key_id}


# ══════════════════════════════════════════════════════════════════════════════
# Audit Log Endpoints
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/audit-logs")
async def list_audit_logs(
    _admin: RequireAdmin,
    session: AsyncSession = Depends(get_session),
    user_email: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Tüm denetim kayıtlarını döner (yalnızca admin)."""
    stmt = select(AuditLog).order_by(desc(AuditLog.created_at))
    if user_email:
        stmt = stmt.where(AuditLog.user_email.ilike(f"%{user_email}%"))
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    stmt = stmt.offset(offset).limit(limit)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return {"data": [audit_log_to_dict(r) for r in rows], "count": len(rows)}


@router.post("/audit-logs/write")
async def write_audit_log(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    request: Request = None,
    action: str = Query(...),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
):
    """Ön-yüzden manuel denetim kaydı yazar (önemli kullanıcı aksiyonları için)."""
    ip = request.client.host if request and request.client else None
    await log_action(session, current_user, action, resource_type, resource_id, ip=ip)
    await session.flush()
    return {"success": True}
