import os

# Ortam değişkenleri
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# CORS origins - virgülle ayrılmış liste, boşluklar strip edilir
_cors_origins_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
)
CORS_ORIGINS = [origin.strip() for origin in _cors_origins_raw.split(",") if origin.strip()]
