# -*- coding: utf-8 -*-
"""Arka plan işleri: export/analyze job başlatma, durum ve indirme."""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import JobStatus
from app.job_store import create_job_sync, job_to_dict
from app.saved_reports import get_saved_report_by_id_optional
from app.tasks import export_report_task, analyze_report_task

router = APIRouter()


@router.post("/export-report/{report_id}")
async def enqueue_export_report(report_id: str):
    """CSV/ZIP export işini kuyruğa ekler; job_id döner."""
    from app.database import async_session_factory
    if not async_session_factory:
        raise HTTPException(status_code=503, detail="Veritabanı yapılandırılmamış")
    async with async_session_factory() as session:
        r = await get_saved_report_by_id_optional(session, report_id)
        if not r:
            raise HTTPException(status_code=404, detail="Rapor bulunamadı")
    job_id = create_job_sync(report_id, "export")
    if not job_id:
        raise HTTPException(status_code=503, detail="Job oluşturulamadı")
    export_report_task.delay(report_id, job_id)
    return {"job_id": job_id, "report_id": report_id, "job_type": "export"}


@router.post("/analyze-report/{report_id}")
async def enqueue_analyze_report(report_id: str):
    """AI analiz işini kuyruğa ekler; job_id döner."""
    from app.database import async_session_factory
    if not async_session_factory:
        raise HTTPException(status_code=503, detail="Veritabanı yapılandırılmamış")
    async with async_session_factory() as session:
        r = await get_saved_report_by_id_optional(session, report_id)
        if not r:
            raise HTTPException(status_code=404, detail="Rapor bulunamadı")
    job_id = create_job_sync(report_id, "analyze")
    if not job_id:
        raise HTTPException(status_code=503, detail="Job oluşturulamadı")
    analyze_report_task.delay(report_id, job_id)
    return {"job_id": job_id, "report_id": report_id, "job_type": "analyze"}


@router.get("/{job_id}")
async def get_job_status(job_id: str, session: AsyncSession = Depends(get_session)):
    """Job durumu ve ilerleme (progress)."""
    result = await session.execute(select(JobStatus).where(JobStatus.id == job_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="İş bulunamadı")
    return job_to_dict(row)


@router.get("/{job_id}/download")
async def download_job_result(job_id: str, session: AsyncSession = Depends(get_session)):
    """Export işi tamamlandıysa dosyayı indirir."""
    result = await session.execute(select(JobStatus).where(JobStatus.id == job_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="İş bulunamadı")
    if row.job_type != "export":
        raise HTTPException(status_code=400, detail="Bu iş indirilebilir değil")
    if row.status != "completed" or not row.file_path:
        raise HTTPException(status_code=404, detail="Dosya henüz hazır değil")
    path = Path(row.file_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Dosya bulunamadı")
    file_name = row.file_name or path.name
    return FileResponse(path, filename=file_name, media_type="application/octet-stream")


@router.get("/{job_id}/pdf")
async def get_analysis_pdf(job_id: str, session: AsyncSession = Depends(get_session)):
    """AI analiz işi tamamlandıysa PDF'i indirir veya görüntüler."""
    result = await session.execute(select(JobStatus).where(JobStatus.id == job_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="İş bulunamadı")
    if row.job_type != "analyze":
        raise HTTPException(status_code=400, detail="Bu iş bir analiz işi değil")
    if row.status != "completed":
        raise HTTPException(status_code=404, detail="Analiz henüz tamamlanmadı")
    if not row.pdf_path:
        raise HTTPException(status_code=404, detail="PDF henüz oluşturulmadı")
    
    path = Path(row.pdf_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="PDF dosyası bulunamadı")
    
    # PDF'i tarayıcıda görüntülemek için inline, indirmek için attachment
    # Türkçe karakterler latin-1 header'da hata verir; RFC 5987 filename* kullan
    file_name = path.name
    from urllib.parse import quote
    safe_name = quote(file_name, safe='')
    return FileResponse(
        path,
        filename="rapor.pdf",
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"rapor.pdf\"; filename*=UTF-8''{safe_name}"
        }
    )


@router.get("/history/analyze")
async def get_analysis_history(session: AsyncSession = Depends(get_session)):
    """Tamamlanmış AI analiz işlemlerini listeler (PDF'ler dahil)."""
    result = await session.execute(
        select(JobStatus)
        .where(JobStatus.job_type == "analyze")
        .where(JobStatus.status == "completed")
        .order_by(JobStatus.created_at.desc())
    )
    rows = result.scalars().all()
    return {"data": [job_to_dict(row) for row in rows], "count": len(rows)}


@router.delete("/{job_id}")
async def delete_job(job_id: str, session: AsyncSession = Depends(get_session)):
    """Job kaydını ve ilgili dosyaları siler."""
    from pathlib import Path
    import os
    
    result = await session.execute(select(JobStatus).where(JobStatus.id == job_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="İş bulunamadı")
    
    # Dosyaları sil (varsa)
    for file_path in [row.file_path, row.pdf_path]:
        if file_path:
            try:
                Path(file_path).unlink(missing_ok=True)
            except Exception:
                pass  # Dosya silinemese de devam et
    
    # Veritabanından sil
    await session.delete(row)
    await session.commit()
    
    return {"message": "Analiz silindi", "job_id": job_id}
