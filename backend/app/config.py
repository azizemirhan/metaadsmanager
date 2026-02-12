import os

# Environment
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

# CORS origins - comma separated
_cors_origins_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
)
CORS_ORIGINS = [origin.strip() for origin in _cors_origins_raw.split(",") if origin.strip()]

# Rate limiting (per IP)
RATE_LIMIT_REQUESTS = os.getenv("RATE_LIMIT_REQUESTS", "60")   # max requests per window
RATE_LIMIT_WINDOW = os.getenv("RATE_LIMIT_WINDOW", "60")       # window in seconds
