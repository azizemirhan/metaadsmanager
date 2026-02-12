from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse, HTMLResponse
from datetime import datetime
import io
from app.services.meta_service import meta_service

router = APIRouter()


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
