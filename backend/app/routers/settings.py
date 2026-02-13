from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app import config

router = APIRouter()


class SettingsUpdate(BaseModel):
    META_ACCESS_TOKEN: Optional[str] = None
    META_AD_ACCOUNT_ID: Optional[str] = None
    META_APP_ID: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    AI_PROVIDER: Optional[str] = None
    OLLAMA_BASE_URL: Optional[str] = None
    OLLAMA_MODEL: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[str] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    META_AD_ACCOUNT_IDS: Optional[str] = None
    META_AD_ACCOUNT_NAMES: Optional[str] = None
    WHATSAPP_PHONE_ID: Optional[str] = None
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: Optional[str] = None


@router.get("")
@router.get("/")
async def get_settings():
    """Mevcut ayarları döndürür; hassas alanlar maskelenir."""
    return config.get_settings_for_api(mask_secrets=True)


@router.put("")
@router.put("/")
async def update_settings(body: SettingsUpdate):
    """Gönderilen alanları kaydeder. Boş string gönderilirse o alan temizlenir."""
    updates = body.model_dump(exclude_unset=True)
    config.save_settings(updates)
    return {"message": "Ayarlar kaydedildi", "settings": config.get_settings_for_api(mask_secrets=True)}
