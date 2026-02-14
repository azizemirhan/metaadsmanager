# -*- coding: utf-8 -*-
"""Celery task'ları: rapor export ve AI analiz (arka planda)."""

import asyncio
import io
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

from app import config
from app.celery_app import app
from app.job_store import update_job_sync
from app.report_storage import get_reports_csv_dir, write_csv_to_disk
from app.report_templates import REPORT_TEMPLATES, get_report_data_for_template, get_template_csv_columns
from app.saved_reports import get_saved_report_by_id_optional
from app.services.meta_service import meta_service, MetaAPIError
from app.database import async_session_factory
from app.pdf_generator import generate_analysis_pdf

# reports router'daki helper
def _get_report_template_ids(r: dict):
    if r.get("template_ids"):
        return r["template_ids"]
    if r.get("template_id"):
        return [r["template_id"]]
    return []


async def _run_export(report_id: str, job_id: str) -> Tuple[Optional[str], Optional[str]]:
    """Raporu çekip CSV/ZIP üretir; (file_path, file_name) döner veya exception."""
    if not async_session_factory:
        raise RuntimeError("Veritabanı yapılandırılmamış")
    async with async_session_factory() as session:
        r = await get_saved_report_by_id_optional(session, report_id)
        if not r:
            raise ValueError("Rapor bulunamadı")
        tids = _get_report_template_ids(r)
        if not tids:
            raise ValueError("Raporda şablon yok")
        days = r.get("days", 30)
        account_id = r.get("ad_account_id")
        report_name = r.get("name", "rapor")
        safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in report_name)[:80]
        date_suffix = datetime.now().strftime("%Y%m%d_%H%M%S")

        def update_progress(progress: int):
            update_job_sync(job_id, progress=progress)

        async def fetch_template_with_retry(tid: str, retries: int = 3) -> list:
            for attempt in range(retries + 1):
                try:
                    return await get_report_data_for_template(tid, days, account_id, meta_service)
                except MetaAPIError as e:
                    err_msg = str(e.args[0]) if e.args else ""
                    is_rate_limit = "limit" in err_msg.lower() or "user request" in err_msg.lower() or "17" in err_msg
                    if attempt < retries and is_rate_limit:
                        await asyncio.sleep(120)  # Meta limit sıfırlanması için 2 dk bekle
                        continue
                    raise

        if len(tids) == 1:
            tid = tids[0]
            await asyncio.get_event_loop().run_in_executor(None, lambda: update_progress(10))
            rows = await fetch_template_with_retry(tid)
            columns = get_template_csv_columns(tid)
            if columns:
                rows = [{k: row.get(k, "") for k in columns} for row in rows]
            csv_content = meta_service.to_csv(rows)
            await asyncio.get_event_loop().run_in_executor(None, lambda: update_progress(70))
            directory = get_reports_csv_dir()
            out_file = directory / f"{safe_name}_{job_id}_{date_suffix}.csv"
            out_file.write_text(csv_content, encoding="utf-8")
            file_name = f"{safe_name}_{date_suffix}.csv"
            await asyncio.get_event_loop().run_in_executor(None, lambda: update_progress(100))
            return str(out_file), file_name

        # Çoklu şablon -> ZIP (her şablon arasında gecikme; rate limit önlemi)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, tid in enumerate(tids):
                p = 10 + int((i + 1) / len(tids) * 80)
                await asyncio.get_event_loop().run_in_executor(None, lambda p=p: update_progress(p))
                if i > 0:
                    await asyncio.sleep(8)
                rows = await fetch_template_with_retry(tid)
                columns = get_template_csv_columns(tid)
                if columns:
                    rows = [{k: row.get(k, "") for k in columns} for row in rows]
                csv_content = meta_service.to_csv(rows)
                tpl = next((t for t in REPORT_TEMPLATES if t["id"] == tid), {})
                slug = tpl.get("id", tid)
                zf.writestr(
                    f"{safe_name}_{slug}_{date_suffix}.csv",
                    csv_content.encode("utf-8"),
                )
        await asyncio.get_event_loop().run_in_executor(None, lambda: update_progress(95))
        directory = get_reports_csv_dir()
        zip_path = directory / f"{safe_name}_{job_id}_{date_suffix}.zip"
        zip_path.write_bytes(buf.getvalue())
        file_name = f"{safe_name}_{date_suffix}.zip"
        await asyncio.get_event_loop().run_in_executor(None, lambda: update_progress(100))
        return str(zip_path), file_name


@app.task(bind=True, name="app.tasks.export_report")
def export_report_task(self, report_id: str, job_id: str) -> None:
    """Kayıtlı raporu CSV/ZIP olarak üretir; job durumunu günceller."""
    update_job_sync(job_id, status="running", progress=0)
    try:
        result = asyncio.run(_run_export(report_id, job_id))
        if result:
            file_path, file_name = result
            update_job_sync(
                job_id,
                status="completed",
                progress=100,
                file_path=file_path,
                file_name=file_name,
            )
        else:
            update_job_sync(job_id, status="failed", error_message="Dosya oluşturulamadı")
    except MetaAPIError as e:
        err_msg = str(e.args[0]) if e.args else "Meta API hatası"
        if "limit" in err_msg.lower() or "user request" in err_msg.lower():
            err_msg = (
                "Meta API istek limiti aşıldı. 30–60 dakika bekleyip tekrar deneyin. "
                "Daha önce indirdiyseniz 'Son oluşturulan CSV'yi indir' kullanın."
            )
        update_job_sync(job_id, status="failed", error_message=err_msg)
    except Exception as e:
        update_job_sync(job_id, status="failed", error_message=str(e))


async def _run_analyze(report_id: str, job_id: str) -> tuple[str, Optional[str]]:
    """Kayıtlı raporu AI ile analiz eder; (sonuç_metni, pdf_yolu) döner."""
    from app.services.ai_service import analyze_report_data

    if not async_session_factory:
        raise RuntimeError("Veritabanı yapılandırılmamış")
    async with async_session_factory() as session:
        saved = await get_saved_report_by_id_optional(session, report_id)
        if not saved:
            raise ValueError("Kayıtlı rapor bulunamadı")
        tids = _get_report_template_ids(saved)
        if not tids:
            raise ValueError("Raporda şablon yok")
        days = saved.get("days", 30)
        account_id = saved.get("ad_account_id")
        report_name = saved.get("name", "Rapor")
        parts = []
        total_rows = 0

        def update_progress(progress: int):
            update_job_sync(job_id, progress=progress)

        for i, tid in enumerate(tids):
            p = 5 + int((i + 1) / len(tids) * 90)
            await asyncio.get_event_loop().run_in_executor(None, lambda p=p: update_progress(p))
            if i > 0:
                await asyncio.sleep(2)
            template = next((t for t in REPORT_TEMPLATES if t["id"] == tid), {})
            title = template.get("title", tid)
            try:
                rows = await get_report_data_for_template(tid, days, account_id, meta_service)
            except MetaAPIError as e:
                err_msg = str(e.args[0]) if e.args else "Meta API hatası"
                if "limit" in err_msg.lower() or "17" in err_msg:
                    await asyncio.sleep(60)
                    try:
                        rows = await get_report_data_for_template(tid, days, account_id, meta_service)
                    except MetaAPIError:
                        parts.append(f"## {title}\n\nMeta API istek limiti. Tekrar deneyin.")
                        continue
                else:
                    parts.append(f"## {title}\n\nMeta API hatası: {err_msg}")
                    continue
            columns = get_template_csv_columns(tid)
            if not rows:
                parts.append(f"## {title}\n\nVeri bulunamadı.")
                continue
            total_rows += len(rows)
            try:
                analysis = await analyze_report_data(report_name, title, rows, columns or [])
                parts.append(f"## {title}\n\n{analysis}")
            except Exception as ae:
                parts.append(f"## {title}\n\nAnaliz atlandı: {ae!s}")
        await asyncio.get_event_loop().run_in_executor(None, lambda: update_progress(95))
        
        # PDF oluştur
        result_text = "\n\n---\n\n".join(parts)
        pdf_path = None
        try:
            directory = get_reports_csv_dir()
            safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in report_name)[:80]
            date_suffix = datetime.now().strftime("%Y%m%d_%H%M%S")
            pdf_file = directory / f"{safe_name}_analiz_{date_suffix}.pdf"
            
            pdf_result = generate_analysis_pdf(result_text, report_name, pdf_file)
            if pdf_result:
                pdf_path = str(pdf_result)
        except Exception as pdf_err:
            # PDF oluşturma hatası analizi engellemesin
            print(f"PDF oluşturma hatası: {pdf_err}")
        
        await asyncio.get_event_loop().run_in_executor(None, lambda: update_progress(100))
        return result_text, pdf_path


@app.task(bind=True, name="app.tasks.analyze_report")
def analyze_report_task(self, report_id: str, job_id: str) -> None:
    """Kayıtlı raporu AI ile analiz eder; sonucu job result_text'e ve PDF'e yazar."""
    update_job_sync(job_id, status="running", progress=0)
    try:
        result_text, pdf_path = asyncio.run(_run_analyze(report_id, job_id))
        update_job_sync(
            job_id,
            status="completed",
            progress=100,
            result_text=result_text,
            pdf_path=pdf_path,
        )
    except MetaAPIError as e:
        update_job_sync(
            job_id,
            status="failed",
            error_message=str(e.args[0]) if e.args else "Meta API hatası",
        )
    except Exception as e:
        update_job_sync(job_id, status="failed", error_message=str(e))
