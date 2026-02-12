import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")


def send_report_email(
    to_email: str,
    subject: str,
    html_content: str,
    csv_attachment: bytes = None,
    filename: str = "meta_ads_report.csv"
) -> bool:
    """HTML içerikli rapor e-postası gönder"""
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_USER
        msg["To"] = to_email

        # HTML içeriği
        part = MIMEText(html_content, "html", "utf-8")
        msg.attach(part)

        # CSV eki varsa ekle
        if csv_attachment:
            attachment = MIMEBase("application", "octet-stream")
            attachment.set_payload(csv_attachment)
            encoders.encode_base64(attachment)
            attachment.add_header(
                "Content-Disposition",
                f"attachment; filename={filename}"
            )
            msg.attach(attachment)

        # SMTP ile gönder
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to_email, msg.as_string())

        return True
    except Exception as e:
        print(f"E-posta gönderme hatası: {e}")
        return False


def build_report_html(
    report_text: str,
    summary_data: dict,
    period: str = "Son 7 Gün"
) -> str:
    """Güzel HTML e-posta şablonu"""
    
    total_spend = summary_data.get("spend", 0)
    total_clicks = summary_data.get("clicks", 0)
    total_impressions = summary_data.get("impressions", 0)
    avg_ctr = summary_data.get("ctr", 0)
    
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f6f9; margin: 0; padding: 20px; }}
    .container {{ max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
    .header {{ background: linear-gradient(135deg, #1877F2, #42A5F5); color: white; padding: 32px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 24px; }}
    .header p {{ margin: 8px 0 0; opacity: 0.85; font-size: 14px; }}
    .metrics {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 24px; }}
    .metric-card {{ background: #f8faff; border: 1px solid #e3edff; border-radius: 10px; padding: 16px; text-align: center; }}
    .metric-value {{ font-size: 28px; font-weight: 700; color: #1877F2; }}
    .metric-label {{ font-size: 13px; color: #666; margin-top: 4px; }}
    .analysis {{ padding: 0 24px 24px; }}
    .analysis h2 {{ color: #1a1a1a; font-size: 18px; border-bottom: 2px solid #1877F2; padding-bottom: 8px; }}
    .analysis-content {{ background: #f8faff; border-radius: 10px; padding: 20px; font-size: 14px; line-height: 1.8; white-space: pre-line; }}
    .footer {{ background: #f4f6f9; text-align: center; padding: 16px; font-size: 12px; color: #999; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Meta Ads Haftalık Rapor</h1>
      <p>{period} | {datetime.now().strftime('%d.%m.%Y')}</p>
    </div>
    
    <div class="metrics">
      <div class="metric-card">
        <div class="metric-value">₺{total_spend:,.2f}</div>
        <div class="metric-label">💸 Toplam Harcama</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{total_impressions:,}</div>
        <div class="metric-label">👁️ Gösterim</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">{total_clicks:,}</div>
        <div class="metric-label">🖱️ Tıklama</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">%{avg_ctr:.2f}</div>
        <div class="metric-label">📈 Ort. CTR</div>
      </div>
    </div>
    
    <div class="analysis">
      <h2>🤖 AI Analiz & Öneriler</h2>
      <div class="analysis-content">{report_text}</div>
    </div>
    
    <div class="footer">
      Bu rapor Meta Ads Dashboard tarafından otomatik oluşturulmuştur.
    </div>
  </div>
</body>
</html>
"""
