import os
import json
from pathlib import Path
from typing import Any, Optional

# Ortam değişkenleri
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# PostgreSQL (Docker'da postgres servisi)
DATABASE_URL = os.getenv("DATABASE_URL", "")
# Sync URL (Celery worker için: postgresql://)
DATABASE_URL_SYNC = os.getenv("DATABASE_URL_SYNC", "").strip() or (DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://").replace("postgresql+psycopg2://", "postgresql://") if DATABASE_URL else "")
# Rapor CSV'lerinin yerel diske yazılacağı klasör (Docker'da volume ile kalıcı)
REPORTS_CSV_DIR = os.getenv("REPORTS_CSV_DIR", str(Path(__file__).resolve().parent.parent / "data" / "reports"))
# Celery
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "amqp://guest:guest@localhost:5672//")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

# CORS origins - virgülle ayrılmış liste, boşluklar strip edilir
_cors_origins_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
)
CORS_ORIGINS = [origin.strip() for origin in _cors_origins_raw.split(",") if origin.strip()]

# Ayarlar dosyası (backend dizinine göre)
SETTINGS_DIR = Path(__file__).resolve().parent.parent
SETTINGS_FILE = SETTINGS_DIR / "settings.json"
SETTINGS_MASKED_KEYS = frozenset({
    "META_ACCESS_TOKEN", "META_APP_SECRET", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", 
    "SMTP_PASSWORD", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_WEBHOOK_VERIFY_TOKEN"
})


def _load_settings_raw() -> dict[str, Any]:
    """settings.json dosyasını oku; yoksa boş dict."""
    if not SETTINGS_FILE.exists():
        return {}
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    """Önce settings.json, yoksa env'den değer döner. Boş string env'de yok sayılır."""
    raw = _load_settings_raw()
    val = raw.get(key)
    if val is not None and str(val).strip():
        return str(val).strip()
    env_val = os.getenv(key)
    if env_val is not None and str(env_val).strip():
        return str(env_val).strip()
    return default


def get_setting_int(key: str, default: int = 0) -> int:
    try:
        v = get_setting(key)
        return int(v) if v else default
    except (TypeError, ValueError):
        return default


def get_settings_for_api(mask_secrets: bool = True) -> dict[str, Any]:
    """API yanıtı için tüm ayarlar; hassas alanlar isteğe göre maskelenir."""
    raw = _load_settings_raw()
    out = {}
    all_keys = {
        "META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_APP_ID", "META_APP_SECRET",
        "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "AI_PROVIDER",
        "OLLAMA_BASE_URL", "OLLAMA_MODEL",
        "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD",
        "META_AD_ACCOUNT_IDS", "META_AD_ACCOUNT_NAMES",
        "WHATSAPP_PHONE_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    }
    for key in all_keys:
        val = raw.get(key) or os.getenv(key) or ""
        if mask_secrets and key in SETTINGS_MASKED_KEYS and val:
            out[key] = "***"
        else:
            out[key] = val if isinstance(val, str) else (str(val) if val is not None else "")
    return out


def save_settings(updates: dict[str, Any]) -> None:
    """Verilen anahtarları settings.json'a yazar; mevcut dosyayı korur."""
    current = _load_settings_raw()
    for k, v in updates.items():
        if v is None or (isinstance(v, str) and not v.strip()):
            current.pop(k, None)
        else:
            current[k] = v.strip() if isinstance(v, str) else v
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(current, f, ensure_ascii=False, indent=2)
