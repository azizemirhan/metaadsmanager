# -*- coding: utf-8 -*-
"""JWT ve şifre yardımcıları."""
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

# Ortam değişkenleri (config'den de alınabilir)
JWT_SECRET = os.getenv("JWT_SECRET", "metaads-change-me-in-production-secret-key-32chars")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 saat

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except (ValueError, TypeError, UnknownHashError):
        return False


def create_access_token(sub: str, email: str, role: str, username: str) -> str:
    """JWT access token oluşturur. sub = user id."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "username": username,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


def generate_user_id() -> str:
    return str(uuid.uuid4())
