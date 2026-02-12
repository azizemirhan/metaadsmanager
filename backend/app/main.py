import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.routers import campaigns, reports, ai_analysis, email_reports
from app.config import CORS_ORIGINS, IS_PRODUCTION

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Meta Ads Dashboard API",
    description="Meta Ads raporlama, analiz ve AI önerileri",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(ai_analysis.router, prefix="/api/ai", tags=["AI Analysis"])
app.include_router(email_reports.router, prefix="/api/email", tags=["Email Reports"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Beklenmeyen hata: %s", exc)
    detail = "Bir hata oluştu" if IS_PRODUCTION else str(exc)
    return JSONResponse(status_code=500, content={"detail": detail})


@app.get("/")
async def root():
    return {"message": "Meta Ads Dashboard API çalışıyor"}
