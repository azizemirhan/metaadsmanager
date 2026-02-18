# -*- coding: utf-8 -*-
"""Kullanıcı yönetimi: liste, rol güncelleme (sadece admin)."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.database import get_session
from app.deps import RequireAdmin
from app.models import User, USER_ROLES

router = APIRouter(prefix="/api/users", tags=["Users"])


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class UpdateUserBody(BaseModel):
    role: str | None = None
    is_active: bool | None = None


@router.get("", response_model=list[UserResponse])
@router.get("/", response_model=list[UserResponse])
async def list_users(
    _admin: RequireAdmin,
    session=Depends(get_session),
):
    """Tüm kullanıcıları listeler (sadece admin)."""
    result = await session.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [UserResponse.model_validate(u) for u in users]


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UpdateUserBody,
    admin: RequireAdmin,
    session=Depends(get_session),
):
    """Kullanıcı rolü veya aktiflik durumunu günceller (sadece admin). Kendi rolünü değiştiremez."""
    if admin.id == user_id and body.role is not None and body.role != admin.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendi rolünüzü değiştiremezsiniz",
        )
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı")
    if body.role is not None:
        if body.role not in USER_ROLES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Geçersiz rol. Seçenekler: {USER_ROLES}")
        user.role = body.role
    if body.is_active is not None:
        if admin.id == user_id and not body.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kendinizi devre dışı bırakamazsınız")
        user.is_active = body.is_active
    await session.flush()
    return UserResponse.model_validate(user)
