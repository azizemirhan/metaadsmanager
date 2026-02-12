import logging
import time
from collections import defaultdict
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException
from app.routers import campaigns, reports, ai_analysis, email_reports, settings
from app.routers.settings import load_settings_into_env
from app import config

# Load saved settings into env before services initialize
load_settings_into_env()

# Logger
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Meta Ads Dashboard API",
    description="Meta Ads raporlama, analiz ve AI onerileri",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Rate Limiting Middleware ────────────────────────────────
RATE_LIMIT_REQUESTS = int(config.RATE_LIMIT_REQUESTS)   # requests per window
RATE_LIMIT_WINDOW = int(config.RATE_LIMIT_WINDOW)       # window in seconds

# In-memory store: {ip: [timestamp, ...]}
_rate_store: dict[str, list[float]] = defaultdict(list)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Simple in-memory rate limiter per IP."""
    # Skip rate limiting for health check
    if request.url.path == "/health":
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW

    # Clean old entries and add current
    timestamps = _rate_store[client_ip]
    _rate_store[client_ip] = [t for t in timestamps if t > window_start]
    _rate_store[client_ip].append(now)

    if len(_rate_store[client_ip]) > RATE_LIMIT_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"detail": f"Istek limiti asildi. Dakikada en fazla {RATE_LIMIT_REQUESTS} istek gonderilebilir."},
            headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
        )

    response = await call_next(request)
    return response


# ── Exception Handler ───────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Tum yakalanamayan exception'lari yakala ve logla."""
    logger.exception(exc)

    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        if config.IS_PRODUCTION and status_code >= 500:
            detail = "Bir hata olustu"
        else:
            detail = exc.detail
    else:
        status_code = 500
        detail = "Bir hata olustu" if config.IS_PRODUCTION else str(exc)

    return JSONResponse(
        status_code=status_code,
        content={"detail": detail},
    )


# ── Routers ─────────────────────────────────────────────────
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(ai_analysis.router, prefix="/api/ai", tags=["AI Analysis"])
app.include_router(email_reports.router, prefix="/api/email", tags=["Email Reports"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])


# ── Health & Info ────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "Meta Ads Dashboard API calisiyor", "version": "1.1.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring and load balancers."""
    return {
        "status": "ok",
        "version": "1.1.0",
        "environment": config.ENVIRONMENT,
    }
