from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime
import io
from app.services.meta_service import meta_service

router = APIRouter()


@router.get("/export/csv")
async def export_csv(
    type: str = Query("campaigns", regex="^(campaigns|ads|adsets)$"),
    days: int = Query(30, ge=7, le=365)
):
    """Verileri CSV olarak indir"""
    try:
        if type == "campaigns":
            data = await meta_service.get_campaigns(days)
        elif type == "ads":
            data = await meta_service.get_ads(days=days)
        elif type == "adsets":
            data = await meta_service.get_ad_sets(days=days)
        
        csv_content = meta_service.to_csv(data)
        filename = f"meta_ads_{type}_{datetime.now().strftime('%Y%m%d')}.csv"
        
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
