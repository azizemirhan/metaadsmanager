import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import HTTPException
from app.routers import campaigns, reports, ai_analysis, email_reports, settings
from app.routers.settings import load_settings_into_env
from app import config

# Load saved settings into env before services initialize
load_settings_into_env()

# Logger ayarı
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Meta Ads Dashboard API",
    description="Meta Ads raporlama, analiz ve AI önerileri",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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

app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(ai_analysis.router, prefix="/api/ai", tags=["AI Analysis"])
app.include_router(email_reports.router, prefix="/api/email", tags=["Email Reports"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])

@app.get("/")
async def root():
    return {"message": "Meta Ads Dashboard API çalışıyor ✅"}
