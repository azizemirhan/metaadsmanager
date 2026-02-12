import os
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

SETTINGS_FILE = Path(__file__).resolve().parent.parent.parent / "settings.json"

# Settings keys -> env var names
SETTINGS_MAP = {
    "meta_access_token": "META_ACCESS_TOKEN",
    "meta_ad_account_id": "META_AD_ACCOUNT_ID",
    "meta_app_id": "META_APP_ID",
    "meta_app_secret": "META_APP_SECRET",
    "anthropic_api_key": "ANTHROPIC_API_KEY",
    "gemini_api_key": "GEMINI_API_KEY",
    "ai_provider": "AI_PROVIDER",
    "smtp_host": "SMTP_HOST",
    "smtp_port": "SMTP_PORT",
    "smtp_user": "SMTP_USER",
    "smtp_password": "SMTP_PASSWORD",
}

# Fields that should be masked in GET response
SENSITIVE_FIELDS = {
    "meta_access_token", "meta_app_secret",
    "anthropic_api_key", "gemini_api_key", "smtp_password",
}


def _mask(value: str) -> str:
    """Mask a sensitive value, showing only last 4 chars."""
    if not value:
        return ""
    if len(value) <= 4:
        return "****"
    return "..." + value[-4:]


def _load_settings() -> dict:
    """Load saved settings from JSON file."""
    if SETTINGS_FILE.exists():
        try:
            return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_settings(settings: dict):
    """Persist settings to JSON file."""
    SETTINGS_FILE.write_text(
        json.dumps(settings, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def load_settings_into_env():
    """Called at app startup to load saved settings into env vars."""
    saved = _load_settings()
    for key, env_var in SETTINGS_MAP.items():
        value = saved.get(key)
        if value:
            os.environ[env_var] = value


def _refresh_services(settings: dict):
    """Update in-memory service instances after settings change."""
    from app.services.meta_service import meta_service

    if "meta_access_token" in settings:
        meta_service.token = settings["meta_access_token"]
    if "meta_ad_account_id" in settings:
        meta_service.account_id = settings["meta_ad_account_id"]


@router.get("")
async def get_settings():
    """Return current settings. Sensitive values are masked."""
    saved = _load_settings()
    result = {}

    for key, env_var in SETTINGS_MAP.items():
        # Priority: saved file > environment variable
        value = saved.get(key) or os.getenv(env_var, "")

        if key in SENSITIVE_FIELDS:
            result[key] = {
                "configured": bool(value),
                "masked": _mask(value),
            }
        else:
            result[key] = {
                "configured": bool(value),
                "value": value,
            }

    return result


class SettingsUpdate(BaseModel):
    meta_access_token: Optional[str] = None
    meta_ad_account_id: Optional[str] = None
    meta_app_id: Optional[str] = None
    meta_app_secret: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    ai_provider: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None


@router.put("")
async def update_settings(update: SettingsUpdate):
    """Update settings, persist to file, and refresh services."""
    current = _load_settings()
    updated_fields = []

    for key, env_var in SETTINGS_MAP.items():
        value = getattr(update, key, None)
        if value is not None:
            current[key] = value
            os.environ[env_var] = value
            updated_fields.append(key)

    if not updated_fields:
        return {"message": "Degisiklik yok", "updated": []}

    _save_settings(current)
    _refresh_services(current)

    return {"message": "Ayarlar kaydedildi", "updated": updated_fields}
