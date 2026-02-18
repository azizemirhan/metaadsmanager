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

# Alert sistemi için importlar
from datetime import datetime, timedelta
from uuid import uuid4
from sqlalchemy import select
from app.models import AlertRule, AlertHistory

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


# ============ AKILLI UYARI SİSTEMİ (SMART ALERTS) ============

async def _send_email_alert(email_to: str, subject: str, message: str):
    """E-posta bildirimi gönder."""
    try:
        from app.services.email_service import send_alert_email
        await send_alert_email(to_email=email_to, subject=subject, body=message)
        return True
    except Exception as e:
        print(f"E-posta gönderme hatası: {e}")
        return False


async def _send_whatsapp_alert(phone_to: str, message: str):
    """WhatsApp bildirimi gönder."""
    try:
        from app.services.whatsapp_service import whatsapp_service
        await whatsapp_service.send_message(to_phone=phone_to, body=message)
        return True
    except Exception as e:
        print(f"WhatsApp gönderme hatası: {e}")
        return False


async def _check_single_rule(rule: AlertRule, campaigns: list, session) -> list[dict]:
    """
    Tek bir kuralı kontrol et.
    Dönüş: Tetiklenen alert kayıtları listesi
    """
    triggered_alerts = []
    
    # Cooldown kontrolü
    if rule.last_triggered and rule.cooldown_minutes:
        cooldown_end = rule.last_triggered + timedelta(minutes=rule.cooldown_minutes)
        if datetime.utcnow() < cooldown_end:
            return triggered_alerts  # Henüz cooldown bitmemiş
    
    for campaign in campaigns:
        campaign_id = campaign.get("id")
        campaign_name = campaign.get("name", "Bilinmeyen Kampanya")
        metric_value = campaign.get(rule.metric)
        
        if metric_value is None:
            continue
        
        try:
            metric_value = float(metric_value)
        except (TypeError, ValueError):
            continue
        
        triggered = False
        
        if rule.condition == "lt" and metric_value < rule.threshold:
            triggered = True
            condition_text = "düştü"
        elif rule.condition == "gt" and metric_value > rule.threshold:
            triggered = True
            condition_text = "yükseldi"
        
        if triggered:
            # Metrik formatlama
            if rule.metric == "ctr":
                value_display = f"%{metric_value:.2f}"
                threshold_display = f"%{rule.threshold:.2f}"
            elif rule.metric == "roas":
                value_display = f"{metric_value:.2f}x"
                threshold_display = f"{rule.threshold:.2f}x"
            elif rule.metric in ["spend", "cpc", "cpm"]:
                value_display = f"₺{metric_value:,.2f}"
                threshold_display = f"₺{rule.threshold:,.2f}"
            else:
                value_display = f"{metric_value:,.0f}"
                threshold_display = f"{rule.threshold:,.0f}"
            
            # Bildirim mesajı
            metric_names = {
                "ctr": "CTR",
                "roas": "ROAS",
                "spend": "Harcama",
                "cpc": "CPC",
                "cpm": "CPM",
                "impressions": "Gösterim",
                "clicks": "Tıklama",
                "frequency": "Frequency",
            }
            metric_name = metric_names.get(rule.metric, rule.metric.upper())
            
            message = (
                f"🚨 Meta Ads Uyarısı\n\n"
                f"Kampanya: {campaign_name}\n"
                f"Metrik: {metric_name}\n"
                f"Değer: {value_display}\n"
                f"Eşik: {threshold_display}\n"
                f"Durum: {condition_text} (eşik aşıldı)\n\n"
                f"Kural: {rule.name}"
            )
            
            channels_sent = []
            
            # E-posta gönder
            if "email" in rule.channels and rule.email_to:
                email_sent = await _send_email_alert(
                    rule.email_to,
                    f"Meta Ads Uyarı: {campaign_name} - {metric_name}",
                    message
                )
                if email_sent:
                    channels_sent.append("email")
            
            # WhatsApp gönder
            if "whatsapp" in rule.channels and rule.whatsapp_to:
                wa_sent = await _send_whatsapp_alert(rule.whatsapp_to, message)
                if wa_sent:
                    channels_sent.append("whatsapp")
            
            # AlertHistory kaydet
            alert_record = AlertHistory(
                id=str(uuid4()),
                rule_id=rule.id,
                campaign_id=campaign_id,
                campaign_name=campaign_name,
                metric=rule.metric,
                threshold=rule.threshold,
                actual_value=metric_value,
                message=message,
                channels_sent=channels_sent,
            )
            session.add(alert_record)
            
            # Kuralı güncelle (last_triggered + counter)
            rule.last_triggered = datetime.utcnow()
            rule.trigger_count += 1
            
            triggered_alerts.append({
                "rule_id": rule.id,
                "campaign_id": campaign_id,
                "campaign_name": campaign_name,
                "metric": rule.metric,
                "actual_value": metric_value,
                "channels_sent": channels_sent,
            })
            
            # Bir kural bir seferde sadece bir kampanya için tetiklenir (spam önlemi)
            break
    
    return triggered_alerts


async def _run_alert_checks():
    """Tüm aktif kuralları kontrol eder ve bildirim gönderir."""
    if not async_session_factory:
        print("Alert check: Veritabanı yapılandırılmamış")
        return
    
    async with async_session_factory() as session:
        # Aktif kuralları çek
        stmt = select(AlertRule).where(AlertRule.is_active == True)
        result = await session.execute(stmt)
        rules = result.scalars().all()
        
        if not rules:
            print("Alert check: Aktif kural bulunamadı")
            return
        
        # Hesap bazlı kampanyaları önbelleğe al (performans için)
        campaigns_cache = {}
        all_triggered = []
        
        for rule in rules:
            account_id = rule.ad_account_id
            cache_key = account_id or "default"
            
            if cache_key not in campaigns_cache:
                try:
                    campaigns = await meta_service.get_campaigns(7, account_id=account_id)
                    campaigns_cache[cache_key] = campaigns
                except MetaAPIError as e:
                    print(f"Alert check: Meta API hatası (account={account_id}): {e}")
                    continue
            
            campaigns = campaigns_cache.get(cache_key, [])
            triggered = await _check_single_rule(rule, campaigns, session)
            all_triggered.extend(triggered)
        
        await session.commit()
        
        print(f"Alert check: {len(rules)} kural kontrol edildi, {len(all_triggered)} uyarı tetiklendi.")
        return all_triggered


@app.task(name="app.tasks.check_alert_rules")
def check_alert_rules_task():
    """
    Periyodik olarak çalışan alert kontrol task'ı.
    Celery Beat schedule ile her 15 dakikada bir çalıştırılır.
    """
    try:
        result = asyncio.run(_run_alert_checks())
        return {
            "status": "success",
            "triggered_count": len(result) if result else 0,
        }
    except Exception as e:
        print(f"Alert check task hatası: {e}")
        return {"status": "error", "error": str(e)}


# ============ ZAMANLANMIŞ RAPORLAR (SCHEDULED REPORTS) ============

async def _generate_scheduled_report(report_id: str):
    """Zamanlanmış raporu oluştur ve gönder."""
    from app.services.meta_service import meta_service, MetaAPIError
    from app.services.ai_service import analyze_campaigns
    from app.services.email_service import build_report_html, send_report_email
    from app.services.whatsapp_service import whatsapp_service
    
    if not async_session_factory:
        raise RuntimeError("Veritabanı yapılandırılmamış")
    
    async with async_session_factory() as session:
        # Rapor tanımını al
        from sqlalchemy import select
        result = await session.execute(
            select(ScheduledReport).where(ScheduledReport.id == report_id)
        )
        report = result.scalar_one_or_none()
        
        if not report:
            raise ValueError("Zamanlanmış rapor bulunamadı")
        
        if not report.is_active:
            raise ValueError("Rapor pasif durumda")
        
        # Log kaydı oluştur
        log = ScheduledReportLog(
            id=str(uuid4()),
            scheduled_report_id=report_id,
            status="running",
        )
        session.add(log)
        await session.commit()
        
        try:
            # Meta verilerini çek
            campaigns = await meta_service.get_campaigns(
                days=report.days,
                account_id=report.ad_account_id
            )
            
            # Özet veri oluştur
            summary_data = {
                "campaign_count": len(campaigns),
                "total_spend": sum(float(c.get("spend", 0) or 0) for c in campaigns),
                "total_impressions": sum(int(c.get("impressions", 0) or 0) for c in campaigns),
                "total_clicks": sum(int(c.get("clicks", 0) or 0) for c in campaigns),
                "avg_ctr": sum(float(c.get("ctr", 0) or 0) for c in campaigns) / len(campaigns) if campaigns else 0,
            }
            
            # AI analizi (weekly/performance için)
            ai_analysis = None
            if report.report_type in ["weekly_summary", "performance"] and campaigns:
                try:
                    ai_analysis = await analyze_campaigns(campaigns)
                except Exception as e:
                    print(f"AI analiz hatası: {e}")
                    ai_analysis = "AI analizi oluşturulamadı."
            
            # Bildirim mesajı oluştur
            report_title = {
                "daily_summary": "Günlük Özet Rapor",
                "weekly_summary": "Haftalık Performans Raporu",
                "campaign_list": "Kampanya Listesi",
                "performance": "Performans Analizi",
            }.get(report.report_type, "Meta Ads Rapor")
            
            channels_sent = []
            
            # E-posta gönder
            if "email" in report.channels and report.email_to:
                try:
                    html_content = build_report_html(
                        report_text=ai_analysis or "Rapor detayları aşağıdadır.",
                        summary_data=summary_data,
                        period=f"Son {report.days} Gün"
                    )
                    
                    success = send_report_email(
                        to_email=report.email_to,
                        subject=f"📊 {report_title} - {datetime.now().strftime('%d.%m.%Y')}",
                        html_content=html_content,
                    )
                    
                    if success:
                        channels_sent.append("email")
                except Exception as e:
                    print(f"E-posta gönderim hatası: {e}")
            
            # WhatsApp gönder
            if "whatsapp" in report.channels and report.whatsapp_to:
                try:
                    message = f"""📊 *{report_title}*

📅 {datetime.now().strftime('%d.%m.%Y %H:%M')}
📈 Kampanya Sayısı: {summary_data['campaign_count']}
💰 Toplam Harcama: ₺{summary_data['total_spend']:,.2f}
👁️ Gösterim: {summary_data['total_impressions']:,}
🖱️ Tıklama: {summary_data['total_clicks']:,}
📊 Ort. CTR: %{summary_data['avg_ctr']:.2f}

_Detaylı rapor için dashboard'u ziyaret edin._"""
                    
                    await whatsapp_service.send_message(
                        to_phone=report.whatsapp_to,
                        body=message
                    )
                    channels_sent.append("whatsapp")
                except Exception as e:
                    print(f"WhatsApp gönderim hatası: {e}")
            
            # Log'u güncelle
            log.status = "success"
            log.completed_at = datetime.utcnow()
            log.summary_data = summary_data
            log.ai_analysis = ai_analysis
            log.channels_sent = channels_sent
            
            # Raporun sonraki çalışma zamanını güncelle
            report.last_run_at = datetime.utcnow()
            report.run_count += 1
            
            # Bir sonraki çalışma zamanını hesapla
            from app.routers.scheduled_reports import calculate_next_run
            report.next_run_at = calculate_next_run(
                frequency=report.frequency,
                day_of_week=report.day_of_week,
                day_of_month=report.day_of_month,
                hour=report.hour,
                minute=report.minute,
            )
            
            await session.commit()
            
            return {
                "status": "success",
                "channels_sent": channels_sent,
                "summary": summary_data,
            }
            
        except Exception as e:
            log.status = "failed"
            log.completed_at = datetime.utcnow()
            log.error_message = str(e)
            await session.commit()
            raise


@app.task(name="app.tasks.generate_scheduled_report_task")
def generate_scheduled_report_task(report_id: str):
    """Tek bir zamanlanmış raporu çalıştır."""
    try:
        result = asyncio.run(_generate_scheduled_report(report_id))
        return result
    except Exception as e:
        return {"status": "error", "error": str(e)}


async def _check_due_scheduled_reports():
    """Vadesi gelen zamanlanmış raporları bul ve çalıştır."""
    if not async_session_factory:
        return
    
    async with async_session_factory() as session:
        from sqlalchemy import select, and_
        
        now = datetime.utcnow()
        
        # Vadesi gelen aktif raporları bul
        stmt = select(ScheduledReport).where(
            and_(
                ScheduledReport.is_active == True,
                ScheduledReport.next_run_at <= now
            )
        )
        result = await session.execute(stmt)
        due_reports = result.scalars().all()
        
        if not due_reports:
            return
        
        print(f"[Scheduled Reports] {len(due_reports)} rapor çalıştırılıyor...")
        
        for report in due_reports:
            try:
                # Celery task olarak gönder (asenkron)
                generate_scheduled_report_task.delay(report.id)
                print(f"[Scheduled Reports] Rapor kuyruğa eklendi: {report.name}")
            except Exception as e:
                print(f"[Scheduled Reports] Rapor gönderim hatası ({report.name}): {e}")


@app.task(name="app.tasks.check_scheduled_reports_task")
def check_scheduled_reports_task():
    """
    Her dakika çalışan task - vadesi gelen raporları kontrol eder.
    Celery Beat schedule ile 60 saniyede bir çalıştırılır.
    """
    try:
        asyncio.run(_check_due_scheduled_reports())
        return {"status": "success"}
    except Exception as e:
        print(f"Scheduled reports check hatası: {e}")
        return {"status": "error", "error": str(e)}


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
