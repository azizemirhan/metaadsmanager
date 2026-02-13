from fastapi import APIRouter, Query, HTTPException, Depends
from fastapi.responses import StreamingResponse, HTMLResponse
from datetime import datetime
import asyncio
import io
import uuid
import zipfile
from typing import Optional, List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session_optional
from app.services.meta_service import meta_service, MetaAPIError
from app.report_templates import (
    REPORT_TEMPLATES,
    get_report_data_for_template,
    get_template_csv_columns,
)
from app.saved_reports import (
    load_saved_reports,
    save_saved_reports,
    get_saved_report_by_id,
    get_saved_report_by_id_optional,
    load_saved_reports_db,
    create_saved_report_db,
    delete_saved_report_db,
)
from app.report_storage import write_csv_to_disk, save_csv_record

router = APIRouter()


@router.get("/templates")
async def get_report_templates():
    """15 hazır rapor şablonu listesi."""
    return {"data": REPORT_TEMPLATES, "count": len(REPORT_TEMPLATES)}


@router.get("/export/template/{template_id}")
async def export_template_csv(
    template_id: str,
    days: int = Query(30, ge=1, le=365),
    ad_account_id: Optional[str] = Query(None),
):
    """Seçilen şablon ve tarih aralığına göre CSV indir."""
    if not any(t["id"] == template_id for t in REPORT_TEMPLATES):
        raise HTTPException(status_code=404, detail="Şablon bulunamadı.")
    try:
        rows = await get_report_data_for_template(
            template_id, days, ad_account_id, meta_service
        )
        columns = get_template_csv_columns(template_id)
        if columns:
            rows = [{k: r.get(k, "") for k in columns} for r in rows]
        csv_content = meta_service.to_csv(rows)
        title_slug = next((t["id"] for t in REPORT_TEMPLATES if t["id"] == template_id), template_id)
        filename = f"rapor_{title_slug}_{datetime.now().strftime('%Y%m%d')}.csv"
        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e.args[0]) if e.args else "Meta API hatası.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/templates")
async def export_templates_zip(
    template_ids: str = Query(..., description="Virgülle ayrılmış şablon id'leri"),
    days: int = Query(30, ge=1, le=365),
    ad_account_id: Optional[str] = Query(None),
):
    """Birden fazla şablonu tek ZIP içinde CSV olarak indir (her şablon ayrı dosya)."""
    ids = [tid.strip() for tid in template_ids.split(",") if tid.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="En az bir şablon id gerekli.")
    valid = [tid for tid in ids if any(t["id"] == tid for t in REPORT_TEMPLATES)]
    if len(valid) != len(ids):
        raise HTTPException(status_code=400, detail="Geçersiz şablon id.")
    try:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for tid in valid:
                rows = await get_report_data_for_template(
                    tid, days, ad_account_id, meta_service
                )
                columns = get_template_csv_columns(tid)
                if columns:
                    rows = [{k: r.get(k, "") for k in columns} for r in rows]
                csv_content = meta_service.to_csv(rows)
                title_slug = next((t["id"] for t in REPORT_TEMPLATES if t["id"] == tid), tid)
                zf.writestr(f"rapor_{title_slug}_{datetime.now().strftime('%Y%m%d')}.csv", csv_content.encode("utf-8"))
        buf.seek(0)
        filename = f"raporlar_{datetime.now().strftime('%Y%m%d')}.zip"
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e.args[0]) if e.args else "Meta API hatası.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Kayıtlı raporlar (Hazır Rapor) ---
class SavedReportCreateBody(BaseModel):
    name: str
    template_id: Optional[str] = None
    template_ids: Optional[List[str]] = None
    days: int = 30
    ad_account_id: Optional[str] = None


def _resolve_template_ids(body: SavedReportCreateBody) -> List[str]:
    """Body'den template_ids listesi üret (tek veya çoklu şablon)."""
    if body.template_ids:
        ids = [tid for tid in body.template_ids if tid]
        if ids:
            return ids
    if body.template_id:
        return [body.template_id]
    return []


@router.get("/saved")
async def list_saved_reports(session: Optional[AsyncSession] = Depends(get_db_session_optional)):
    """Kayıtlı hazır raporları listele (PostgreSQL veya JSON)."""
    if session is not None:
        reports = await load_saved_reports_db(session)
    else:
        reports = load_saved_reports()
    return {"data": reports, "count": len(reports)}


@router.post("/saved")
async def create_saved_report(
    body: SavedReportCreateBody,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Hazır rapor olarak kaydet (isim + bir veya birden fazla şablon + gün)."""
    template_ids = _resolve_template_ids(body)
    if not template_ids:
        raise HTTPException(status_code=400, detail="En az bir şablon gerekli.")
    for tid in template_ids:
        if not any(t["id"] == tid for t in REPORT_TEMPLATES):
            raise HTTPException(status_code=400, detail=f"Geçersiz şablon ID: {tid}")
    new_id = str(uuid.uuid4())[:8]
    if session is not None:
        await create_saved_report_db(
            session, new_id, body.name, template_ids, body.days, body.ad_account_id
        )
    else:
        reports = load_saved_reports()
        reports.append({
            "id": new_id,
            "name": body.name,
            "template_ids": template_ids,
            "days": body.days,
            "ad_account_id": body.ad_account_id,
            "created_at": datetime.now().isoformat(),
        })
        save_saved_reports(reports)
    return {"success": True, "id": new_id, "message": "Rapor kaydedildi."}


@router.get("/saved/{report_id}")
async def get_saved_report(
    report_id: str,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Kayıtlı rapor detayı."""
    if session is not None:
        r = await get_saved_report_by_id_optional(session, report_id)
    else:
        r = get_saved_report_by_id(report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    return r


def _get_report_template_ids(r: dict) -> List[str]:
    """Kayıtlı rapor kaydından şablon id listesini al (eski template_id veya template_ids)."""
    if r.get("template_ids"):
        return r["template_ids"]
    if r.get("template_id"):
        return [r["template_id"]]
    return []


@router.get("/saved/{report_id}/data")
async def get_saved_report_data(
    report_id: str,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Kayıtlı raporun verisini JSON olarak döndürür (AI analizi için). Tek veya çoklu şablon destekler."""
    r = await get_saved_report_by_id_optional(session, report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    tids = _get_report_template_ids(r)
    if not tids:
        raise HTTPException(status_code=400, detail="Raporda şablon bilgisi yok.")
    try:
        days = r.get("days", 30)
        account_id = r.get("ad_account_id")
        templates_payload = []
        for tid in tids:
            rows = await get_report_data_for_template(tid, days, account_id, meta_service)
            tpl = next((t for t in REPORT_TEMPLATES if t["id"] == tid), {})
            columns = get_template_csv_columns(tid)
            templates_payload.append({
                "template_id": tid,
                "template_title": tpl.get("title"),
                "data": rows,
                "columns": columns or [],
            })
        if len(templates_payload) == 1:
            t0 = templates_payload[0]
            return {
                "report_id": report_id,
                "name": r.get("name"),
                "template_title": t0["template_title"],
                "days": days,
                "data": t0["data"],
                "columns": t0["columns"],
                "templates": templates_payload,
            }
        return {
            "report_id": report_id,
            "name": r.get("name"),
            "days": days,
            "templates": templates_payload,
        }
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e.args[0]) if e.args else "Meta API hatası.")


@router.get("/saved/{report_id}/export")
async def export_saved_report_csv(
    report_id: str,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Kayıtlı raporu CSV olarak indir. Çoklu şablonda ZIP. CSV yerel diske de yazılır."""
    r = await get_saved_report_by_id_optional(session, report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    tids = _get_report_template_ids(r)
    if not tids:
        raise HTTPException(status_code=400, detail="Raporda şablon bilgisi yok.")
    days = r.get("days", 30)
    account_id = r.get("ad_account_id")
    report_name = r.get("name", "rapor")
    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in report_name)
    try:
        if len(tids) == 1:
            tid = tids[0]
            rows = await get_report_data_for_template(tid, days, account_id, meta_service)
            columns = get_template_csv_columns(tid)
            if columns:
                rows = [{k: row.get(k, "") for k in columns} for row in rows]
            csv_content = meta_service.to_csv(rows)
            full_path, file_name = write_csv_to_disk(report_id, tid, csv_content, report_name)
            await save_csv_record(session, report_id, tid, full_path, file_name)
            filename = f"{safe_name}_{datetime.now().strftime('%Y%m%d')}.csv"
            return StreamingResponse(
                io.StringIO(csv_content),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for tid in tids:
                rows = await get_report_data_for_template(tid, days, account_id, meta_service)
                columns = get_template_csv_columns(tid)
                if columns:
                    rows = [{k: row.get(k, "") for k in columns} for row in rows]
                csv_content = meta_service.to_csv(rows)
                tpl = next((t for t in REPORT_TEMPLATES if t["id"] == tid), {})
                slug = tpl.get("id", tid)
                zf.writestr(
                    f"{safe_name}_{slug}_{datetime.now().strftime('%Y%m%d')}.csv",
                    csv_content.encode("utf-8"),
                )
                full_path, file_name = write_csv_to_disk(report_id, tid, csv_content, report_name)
                await save_csv_record(session, report_id, tid, full_path, file_name)
        buf.seek(0)
        filename = f"{safe_name}_{datetime.now().strftime('%Y%m%d')}.zip"
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except MetaAPIError as e:
        raise HTTPException(status_code=503, detail=str(e.args[0]) if e.args else "Meta API hatası.")


@router.post("/saved/{report_id}/write-csv")
async def write_saved_report_csv_to_disk(
    report_id: str,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Kayıtlı raporun tüm şablonları için veriyi çekip CSV dosyalarını yerel diske yazar (backend/data/reports). İndirme yapmaz."""
    r = await get_saved_report_by_id_optional(session, report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    tids = _get_report_template_ids(r)
    if not tids:
        raise HTTPException(status_code=400, detail="Raporda şablon bilgisi yok.")
    days = r.get("days", 30)
    account_id = r.get("ad_account_id")
    report_name = r.get("name", "rapor")
    files_written: List[dict] = []
    errors: List[str] = []
    for i, tid in enumerate(tids):
        if i > 0:
            await asyncio.sleep(2)
        try:
            rows = await get_report_data_for_template(tid, days, account_id, meta_service)
            columns = get_template_csv_columns(tid)
            if columns:
                rows = [{k: row.get(k, "") for k in columns} for row in rows]
            csv_content = meta_service.to_csv(rows)
            full_path, file_name = write_csv_to_disk(report_id, tid, csv_content, report_name)
            await save_csv_record(session, report_id, tid, full_path, file_name)
            files_written.append({"template_id": tid, "file_name": file_name, "path": str(full_path)})
        except MetaAPIError as e:
            err_msg = str(e.args[0]) if e.args else "Meta API hatası"
            errors.append(f"{tid}: {err_msg}")
        except Exception as e:
            errors.append(f"{tid}: {e!s}")
    return {
        "success": True,
        "written": len(files_written),
        "files": files_written,
        "errors": errors if errors else None,
    }


@router.delete("/saved/{report_id}")
async def delete_saved_report(
    report_id: str,
    session: Optional[AsyncSession] = Depends(get_db_session_optional),
):
    """Kayıtlı raporu sil."""
    if session is not None:
        deleted = await delete_saved_report_db(session, report_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    else:
        reports = load_saved_reports()
        new_list = [x for x in reports if x.get("id") != report_id]
        if len(new_list) == len(reports):
            raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
        save_saved_reports(new_list)
    return {"success": True, "message": "Rapor silindi."}


@router.get("/export/csv")
async def export_csv(
    type: str = Query("campaigns", regex="^(campaigns|ads|adsets|daily)$"),
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
        elif type == "daily":
            data = await meta_service.get_daily_breakdown(days)

        csv_content = meta_service.to_csv(data)
        filename = f"meta_ads_{type}_{datetime.now().strftime('%Y%m%d')}.csv"

        return StreamingResponse(
            io.StringIO(csv_content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _build_html_report(title: str, period: str, body_content: str) -> str:
    """Ortak HTML rapor sablonu"""
    now = datetime.now().strftime("%d.%m.%Y %H:%M")
    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>{title}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 20px; color: #1a1a1a; }}
  .container {{ max-width: 900px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }}
  .header {{ background: linear-gradient(135deg, #1877F2, #42A5F5); color: white; padding: 32px; text-align: center; }}
  .header h1 {{ margin: 0; font-size: 22px; }}
  .header p {{ margin: 8px 0 0; opacity: 0.85; font-size: 13px; }}
  .content {{ padding: 24px; }}
  .metrics {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 14px; margin-bottom: 24px; }}
  .metric-card {{ background: #f8faff; border: 1px solid #e3edff; border-radius: 10px; padding: 16px; text-align: center; }}
  .metric-value {{ font-size: 22px; font-weight: 700; color: #1877F2; }}
  .metric-label {{ font-size: 12px; color: #666; margin-top: 4px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  th {{ background: #f8faff; color: #1877F2; text-align: left; padding: 10px 12px; font-weight: 600; border-bottom: 2px solid #e3edff; }}
  td {{ padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }}
  tr:hover td {{ background: #fafbff; }}
  .section-title {{ font-size: 16px; font-weight: 700; margin: 24px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #1877F2; }}
  .footer {{ background: #f4f6f9; text-align: center; padding: 16px; font-size: 11px; color: #999; }}
  .badge {{ display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }}
  .badge-active {{ background: rgba(0,214,143,0.1); color: #00d68f; }}
  .badge-paused {{ background: rgba(122,139,168,0.1); color: #7a8ba8; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>{title}</h1>
    <p>{period} | Olusturulma: {now}</p>
  </div>
  <div class="content">
    {body_content}
  </div>
  <div class="footer">
    Bu rapor Meta Ads Dashboard tarafindan otomatik olusturulmustur.
  </div>
</div>
</body>
</html>"""


@router.get("/export/html")
async def export_html(
    report_type: str = Query("weekly_summary", regex="^(weekly_summary|campaign_comparison|performance_trend)$"),
    days: int = Query(30, ge=7, le=365)
):
    """HTML rapor olustur ve indir"""
    try:
        period = f"Son {days} Gun"

        if report_type == "weekly_summary":
            summary = await meta_service.get_account_summary(days)
            campaigns = await meta_service.get_campaigns(days)
            top5 = sorted(campaigns, key=lambda c: float(c.get("spend", 0)), reverse=True)[:5]

            spend = float(summary.get("spend", 0))
            impressions = int(summary.get("impressions", 0))
            clicks = int(summary.get("clicks", 0))
            ctr = float(summary.get("ctr", 0))
            cpc = float(summary.get("cpc", 0))
            cpm = float(summary.get("cpm", 0))

            metrics_html = f"""
            <div class="metrics">
              <div class="metric-card"><div class="metric-value">₺{spend:,.2f}</div><div class="metric-label">Toplam Harcama</div></div>
              <div class="metric-card"><div class="metric-value">{impressions:,}</div><div class="metric-label">Gosterim</div></div>
              <div class="metric-card"><div class="metric-value">{clicks:,}</div><div class="metric-label">Tiklama</div></div>
              <div class="metric-card"><div class="metric-value">%{ctr:.2f}</div><div class="metric-label">Ort. CTR</div></div>
              <div class="metric-card"><div class="metric-value">₺{cpc:.2f}</div><div class="metric-label">Ort. CPC</div></div>
              <div class="metric-card"><div class="metric-value">₺{cpm:.2f}</div><div class="metric-label">CPM</div></div>
            </div>"""

            table_rows = ""
            for c in top5:
                status_cls = "badge-active" if c.get("status") == "ACTIVE" else "badge-paused"
                status_txt = "Aktif" if c.get("status") == "ACTIVE" else c.get("status", "")
                table_rows += f"""<tr>
                  <td>{c.get('name','')}</td>
                  <td><span class="badge {status_cls}">{status_txt}</span></td>
                  <td>₺{float(c.get('spend',0)):,.2f}</td>
                  <td>{int(c.get('clicks',0)):,}</td>
                  <td>%{float(c.get('ctr',0)):.2f}</td>
                  <td>{float(c.get('roas',0)):.2f}x</td>
                </tr>"""

            body = f"""{metrics_html}
            <div class="section-title">En Iyi 5 Kampanya</div>
            <table>
              <thead><tr><th>Kampanya</th><th>Durum</th><th>Harcama</th><th>Tiklama</th><th>CTR</th><th>ROAS</th></tr></thead>
              <tbody>{table_rows}</tbody>
            </table>
            <p style="margin-top:16px;font-size:13px;color:#666;">Toplam {len(campaigns)} kampanya bulundu.</p>"""

            html = _build_html_report("Haftalik Ozet Raporu", period, body)

        elif report_type == "campaign_comparison":
            campaigns = await meta_service.get_campaigns(days)
            campaigns_sorted = sorted(campaigns, key=lambda c: float(c.get("spend", 0)), reverse=True)

            table_rows = ""
            for c in campaigns_sorted:
                status_cls = "badge-active" if c.get("status") == "ACTIVE" else "badge-paused"
                status_txt = "Aktif" if c.get("status") == "ACTIVE" else c.get("status", "")
                table_rows += f"""<tr>
                  <td>{c.get('name','')}</td>
                  <td><span class="badge {status_cls}">{status_txt}</span></td>
                  <td>₺{float(c.get('spend',0)):,.2f}</td>
                  <td>{int(c.get('impressions',0)):,}</td>
                  <td>{int(c.get('clicks',0)):,}</td>
                  <td>%{float(c.get('ctr',0)):.2f}</td>
                  <td>₺{float(c.get('cpc',0)):.2f}</td>
                  <td>₺{float(c.get('cpm',0)):.2f}</td>
                  <td>{float(c.get('roas',0)):.2f}x</td>
                </tr>"""

            body = f"""<div class="section-title">Kampanya Karsilastirmasi ({len(campaigns_sorted)} kampanya)</div>
            <div style="overflow-x:auto;">
            <table>
              <thead><tr><th>Kampanya</th><th>Durum</th><th>Harcama</th><th>Gosterim</th><th>Tiklama</th><th>CTR</th><th>CPC</th><th>CPM</th><th>ROAS</th></tr></thead>
              <tbody>{table_rows}</tbody>
            </table>
            </div>"""

            html = _build_html_report("Kampanya Karsilastirma Raporu", period, body)

        elif report_type == "performance_trend":
            daily = await meta_service.get_daily_breakdown(days)
            summary = await meta_service.get_account_summary(days)

            spend = float(summary.get("spend", 0))
            impressions = int(summary.get("impressions", 0))
            clicks = int(summary.get("clicks", 0))
            ctr = float(summary.get("ctr", 0))

            metrics_html = f"""
            <div class="metrics">
              <div class="metric-card"><div class="metric-value">₺{spend:,.2f}</div><div class="metric-label">Toplam Harcama</div></div>
              <div class="metric-card"><div class="metric-value">{impressions:,}</div><div class="metric-label">Toplam Gosterim</div></div>
              <div class="metric-card"><div class="metric-value">{clicks:,}</div><div class="metric-label">Toplam Tiklama</div></div>
              <div class="metric-card"><div class="metric-value">%{ctr:.2f}</div><div class="metric-label">Ort. CTR</div></div>
            </div>"""

            table_rows = ""
            for d in daily:
                table_rows += f"""<tr>
                  <td>{d.get('date_start','')}</td>
                  <td>₺{float(d.get('spend',0)):,.2f}</td>
                  <td>{int(d.get('impressions',0)):,}</td>
                  <td>{int(d.get('clicks',0)):,}</td>
                  <td>%{float(d.get('ctr',0)):.2f}</td>
                </tr>"""

            body = f"""{metrics_html}
            <div class="section-title">Gunluk Performans ({len(daily)} gun)</div>
            <table>
              <thead><tr><th>Tarih</th><th>Harcama</th><th>Gosterim</th><th>Tiklama</th><th>CTR</th></tr></thead>
              <tbody>{table_rows}</tbody>
            </table>"""

            html = _build_html_report("Performans Trendi Raporu", period, body)

        filename = f"meta_ads_{report_type}_{datetime.now().strftime('%Y%m%d')}.html"
        return StreamingResponse(
            io.StringIO(html),
            media_type="text/html",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
