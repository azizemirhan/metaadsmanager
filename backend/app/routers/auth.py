# -*- coding: utf-8 -*-
"""Kimlik doğrulama: giriş, kayıt, me."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from app.auth import create_access_token, hash_password, verify_password, generate_user_id
from app.database import get_session
from app.deps import get_current_user
from app.models import User, USER_ROLES

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginBody(BaseModel):
    email: str
    password: str


class RegisterBody(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: str = "viewer"  # İlk kullanıcıyı admin yapmak için backend'de kontrol


class UserResponse(BaseModel):
    id: str
    email: str
    username: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


@router.post("/login")
async def login(
    body: LoginBody,
    session=Depends(get_session),
):
    """E-posta ve şifre ile giriş. JWT access_token döner."""
    result = await session.execute(select(User).where(User.email == body.email.strip().lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hesap devre dışı")
    token = create_access_token(
        sub=user.id,
        email=user.email,
        role=user.role,
        username=user.username,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
    }


@router.post("/register")
async def register(
    body: RegisterBody,
    session=Depends(get_session),
):
    """Yeni kullanıcı kaydı. İlk kayıt admin, sonrakiler varsayılan viewer."""
    email = body.email.strip().lower()
    if not body.username or not body.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kullanıcı adı ve şifre gerekli")
    if len(body.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Şifre en az 6 karakter olmalı")
    role = (body.role or "viewer").strip().lower()
    if role not in USER_ROLES:
        role = "viewer"

    result = await session.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu e-posta zaten kayıtlı")

    # İlk kullanıcı otomatik admin; sonrakiler her zaman viewer (güvenlik)
    count_result = await session.execute(select(User))
    count = len(count_result.scalars().all())
    if count == 0:
        role = "admin"
    else:
        role = "viewer"

    user = User(
        id=generate_user_id(),
        email=email,
        username=body.username.strip() or email.split("@")[0],
        hashed_password=hash_password(body.password),
        role=role,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    token = create_access_token(
        sub=user.id,
        email=user.email,
        role=user.role,
        username=user.username,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
    }


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Giriş yapmış kullanıcı bilgisi."""
    return current_user
