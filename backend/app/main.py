import logging
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException
from app.routers import campaigns, adsets, reports, ai_analysis, email_reports, settings, creatives, ads, whatsapp, jobs, targeting, ad_summaries, alerts, webhooks, scheduled_reports, auth, users
from app import config
from app.database import init_db
from app.deps import get_current_user

# Logger ayarı
logger = logging.getLogger(__name__)

# Basit rate limit: IP başına dakikada 120 istek
RATE_LIMIT_REQUESTS = 120
RATE_LIMIT_WINDOW = 60  # saniye
_rate_limit_store: dict[str, list[float]] = defaultdict(list)


async def _rate_limit_middleware(request: Request, call_next):
    """API isteklerini dakikada 120 ile sınırlar (IP bazlı)."""
    if not config.IS_PRODUCTION:
        return await call_next(request)
    client = request.client.host if request.client else "unknown"
    now = time.time()
    # Eski kayıtları temizle
    _rate_limit_store[client] = [t for t in _rate_limit_store[client] if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit_store[client]) >= RATE_LIMIT_REQUESTS:
        return JSONResponse(
            status_code=429,
            content={"detail": "Çok fazla istek. Lütfen bir dakika bekleyin."},
        )
    _rate_limit_store[client].append(now)
    return await call_next(request)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama başlarken PostgreSQL tablolarını oluşturur."""
    await init_db()
    yield
    # shutdown: nothing to do


app = FastAPI(
    title="Meta Ads Dashboard API",
    description="Meta Ads raporlama, analiz ve AI önerileri",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(_rate_limit_middleware)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Tüm yakalanmamış exception'ları yakala ve logla."""
    logger.exception(exc)
    
    # HTTPException ise status_code ve detail'ini al
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        # Production'da detayı gizle (500 hataları için)
        if config.IS_PRODUCTION and status_code >= 500:
            detail = "Bir hata oluştu"
        else:
            detail = exc.detail
    else:
        status_code = 500
        detail = "Bir hata oluştu" if config.IS_PRODUCTION else str(exc)
    
    return JSONResponse(
        status_code=status_code,
        content={"detail": detail}
    )

# Auth ve webhooks korumasız; diğer tüm API'ler giriş gerektirir
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"], dependencies=[Depends(get_current_user)])
app.include_router(adsets.router, prefix="/api/adsets", tags=["Ad Sets"], dependencies=[Depends(get_current_user)])
app.include_router(creatives.router, prefix="/api/creatives", tags=["Creatives"], dependencies=[Depends(get_current_user)])
app.include_router(ads.router, prefix="/api/ads", tags=["Ads"], dependencies=[Depends(get_current_user)])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"], dependencies=[Depends(get_current_user)])
app.include_router(ai_analysis.router, prefix="/api/ai", tags=["AI Analysis"], dependencies=[Depends(get_current_user)])
app.include_router(email_reports.router, prefix="/api/email", tags=["Email Reports"], dependencies=[Depends(get_current_user)])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"], dependencies=[Depends(get_current_user)])
app.include_router(whatsapp.router, prefix="/api/whatsapp", tags=["WhatsApp"], dependencies=[Depends(get_current_user)])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"], dependencies=[Depends(get_current_user)])
app.include_router(targeting.router, prefix="/api/targeting", tags=["Targeting"], dependencies=[Depends(get_current_user)])
app.include_router(ad_summaries.router, prefix="/api/ad-summaries", tags=["Ad Summaries"], dependencies=[Depends(get_current_user)])
app.include_router(alerts.router, tags=["Alerts"], dependencies=[Depends(get_current_user)])
app.include_router(webhooks.router, tags=["Webhooks"])  # Meta callback için korumasız
app.include_router(scheduled_reports.router, tags=["Scheduled Reports"], dependencies=[Depends(get_current_user)])


@app.get("/")
async def root():
    return {"message": "Meta Ads Dashboard API çalışıyor ✅"}
