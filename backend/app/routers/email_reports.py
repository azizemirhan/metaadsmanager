from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from app.services.meta_service import meta_service
from app.services.ai_service import generate_weekly_report_text
from app.services.email_service import send_report_email, build_report_html

router = APIRouter()


class EmailReportRequest(BaseModel):
    to_email: str
    period_days: int = 7
    include_csv: bool = True


@router.post("/send-report")
async def send_weekly_report(request: EmailReportRequest):
    """Haftalık raporu e-posta ile gönder"""
    try:
        # Veri çek
        campaigns = await meta_service.get_campaigns(request.period_days)
        summary = await meta_service.get_account_summary(request.period_days)
        
        # AI raporu oluştur
        report_text = await generate_weekly_report_text({
            "campaigns": campaigns[:10],
            "summary": summary,
            "period_days": request.period_days
        })
        
        # HTML e-posta oluştur
        html = build_report_html(
            report_text=report_text,
            summary_data=summary,
            period=f"Son {request.period_days} Gün"
        )
        
        # CSV eki
        csv_bytes = None
        if request.include_csv:
            csv_content = meta_service.to_csv(campaigns)
            csv_bytes = csv_content.encode("utf-8")
        
        # Gönder
        success = send_report_email(
            to_email=request.to_email,
            subject=f"📊 Meta Ads Raporu - Son {request.period_days} Gün",
            html_content=html,
            csv_attachment=csv_bytes
        )
        
        if success:
            return {"message": f"Rapor {request.to_email} adresine gönderildi ✅"}
        else:
            raise HTTPException(status_code=500, detail="E-posta gönderilemedi")
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
