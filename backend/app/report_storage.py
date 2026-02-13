# -*- coding: utf-8 -*-
"""Rapor CSV'lerini yerel diske yazma ve PostgreSQL'e kayıt."""

from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app import config
from app.models import ReportCsvFile


def get_reports_csv_dir() -> Path:
    """CSV klasörünü döndürür ve yoksa oluşturur."""
    p = Path(config.REPORTS_CSV_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def write_csv_to_disk(
    report_id: str,
    template_id: str,
    csv_content: str,
    report_name: str = "rapor",
) -> tuple[Path, str]:
    """
    CSV içeriğini yerel diske yazar.
    Returns: (full_path, file_name_for_download)
    """
    directory = get_reports_csv_dir()
    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in report_name)[:80]
    date_suffix = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"{safe_name}_{template_id}_{date_suffix}.csv"
    full_path = directory / file_name
    full_path.write_text(csv_content, encoding="utf-8")
    return full_path, file_name


async def save_csv_record(
    session: Optional[AsyncSession],
    report_id: str,
    template_id: str,
    file_path: Path,
    file_name: str,
) -> None:
    """PostgreSQL'de report_csv_files tablosuna kayıt ekler (session varsa)."""
    if session is None:
        return
    record = ReportCsvFile(
        report_id=report_id,
        template_id=template_id,
        file_path=str(file_path),
        file_name=file_name,
    )
    session.add(record)
