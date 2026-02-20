# -*- coding: utf-8 -*-
"""Bulut Depolama Servis: AWS S3 ve Google Cloud Storage entegrasyonu."""
from __future__ import annotations

import os
import asyncio
from typing import Optional
from pathlib import Path

from app import config


class CloudExportError(Exception):
    pass


class CloudExportService:
    """S3 veya GCS'e dosya yükler. Kimlik bilgileri Settings'den alınır."""

    # ─── S3 ──────────────────────────────────────────────────────────────────

    async def upload_to_s3(
        self,
        file_path: str,
        bucket: str,
        object_key: str,
        aws_access_key: Optional[str] = None,
        aws_secret_key: Optional[str] = None,
        aws_region: Optional[str] = None,
    ) -> dict:
        """Dosyayı AWS S3'e yükler. boto3 kurulu değilse hata verir."""
        try:
            import boto3  # type: ignore
            from botocore.exceptions import ClientError, BotoCoreError  # type: ignore
        except ImportError:
            raise CloudExportError(
                "boto3 kurulu değil. 'pip install boto3' komutuyla yükleyin."
            )

        key_id = aws_access_key or config.get_setting("AWS_ACCESS_KEY_ID")
        secret = aws_secret_key or config.get_setting("AWS_SECRET_ACCESS_KEY")
        region = aws_region or config.get_setting("AWS_REGION") or "us-east-1"

        if not key_id or not secret:
            raise CloudExportError("AWS kimlik bilgileri eksik (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).")

        if not Path(file_path).exists():
            raise CloudExportError(f"Dosya bulunamadı: {file_path}")

        def _upload():
            client = boto3.client(
                "s3",
                aws_access_key_id=key_id,
                aws_secret_access_key=secret,
                region_name=region,
            )
            client.upload_file(file_path, bucket, object_key)
            size = Path(file_path).stat().st_size
            return {
                "provider": "s3",
                "bucket": bucket,
                "object_key": object_key,
                "file_size_bytes": size,
                "url": f"s3://{bucket}/{object_key}",
            }

        return await asyncio.get_event_loop().run_in_executor(None, _upload)

    # ─── GCS ─────────────────────────────────────────────────────────────────

    async def upload_to_gcs(
        self,
        file_path: str,
        bucket: str,
        object_key: str,
        gcs_project: Optional[str] = None,
        gcs_credentials_json: Optional[str] = None,
    ) -> dict:
        """Dosyayı Google Cloud Storage'a yükler. google-cloud-storage kurulu değilse hata verir."""
        try:
            from google.cloud import storage as gcs_storage  # type: ignore
            from google.oauth2 import service_account  # type: ignore
            import json
        except ImportError:
            raise CloudExportError(
                "google-cloud-storage kurulu değil. 'pip install google-cloud-storage' komutuyla yükleyin."
            )

        project = gcs_project or config.get_setting("GCS_PROJECT_ID")
        creds_json = gcs_credentials_json or config.get_setting("GCS_CREDENTIALS_JSON")

        if not Path(file_path).exists():
            raise CloudExportError(f"Dosya bulunamadı: {file_path}")

        def _upload():
            import json as _json
            if creds_json:
                creds_info = _json.loads(creds_json)
                creds = service_account.Credentials.from_service_account_info(creds_info)
                client = gcs_storage.Client(project=project, credentials=creds)
            else:
                client = gcs_storage.Client(project=project)

            bkt = client.bucket(bucket)
            blob = bkt.blob(object_key)
            blob.upload_from_filename(file_path)
            size = Path(file_path).stat().st_size
            return {
                "provider": "gcs",
                "bucket": bucket,
                "object_key": object_key,
                "file_size_bytes": size,
                "url": f"gs://{bucket}/{object_key}",
            }

        return await asyncio.get_event_loop().run_in_executor(None, _upload)

    # ─── Genel yükleme ───────────────────────────────────────────────────────

    async def upload(
        self,
        file_path: str,
        bucket: str,
        object_key: str,
        provider: str = "s3",
    ) -> dict:
        """Provider'a göre yönlendirir ('s3' veya 'gcs')."""
        if provider == "s3":
            return await self.upload_to_s3(file_path, bucket, object_key)
        elif provider == "gcs":
            return await self.upload_to_gcs(file_path, bucket, object_key)
        else:
            raise CloudExportError(f"Desteklenmeyen provider: {provider}. 's3' veya 'gcs' kullanın.")

    # ─── Bağlantı testi ──────────────────────────────────────────────────────

    async def test_connection(self, provider: str, bucket: str) -> dict:
        """Bucket'a okuma/listeleme erişimini test eder."""
        if provider == "s3":
            return await self._test_s3(bucket)
        elif provider == "gcs":
            return await self._test_gcs(bucket)
        return {"success": False, "error": f"Bilinmeyen provider: {provider}"}

    async def _test_s3(self, bucket: str) -> dict:
        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError:
            return {"success": False, "error": "boto3 kurulu değil."}

        key_id = config.get_setting("AWS_ACCESS_KEY_ID")
        secret = config.get_setting("AWS_SECRET_ACCESS_KEY")
        region = config.get_setting("AWS_REGION") or "us-east-1"

        if not key_id or not secret:
            return {"success": False, "error": "AWS kimlik bilgileri eksik."}

        def _test():
            client = boto3.client(
                "s3",
                aws_access_key_id=key_id,
                aws_secret_access_key=secret,
                region_name=region,
            )
            client.head_bucket(Bucket=bucket)
            return {"success": True, "provider": "s3", "bucket": bucket}

        try:
            return await asyncio.get_event_loop().run_in_executor(None, _test)
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def _test_gcs(self, bucket: str) -> dict:
        try:
            from google.cloud import storage as gcs_storage
        except ImportError:
            return {"success": False, "error": "google-cloud-storage kurulu değil."}

        creds_json = config.get_setting("GCS_CREDENTIALS_JSON")
        project = config.get_setting("GCS_PROJECT_ID")

        def _test():
            import json
            if creds_json:
                from google.oauth2 import service_account
                creds_info = json.loads(creds_json)
                creds = service_account.Credentials.from_service_account_info(creds_info)
                client = gcs_storage.Client(project=project, credentials=creds)
            else:
                client = gcs_storage.Client(project=project)
            bkt = client.bucket(bucket)
            bkt.reload()
            return {"success": True, "provider": "gcs", "bucket": bucket}

        try:
            return await asyncio.get_event_loop().run_in_executor(None, _test)
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ─── Rapor arşivi ────────────────────────────────────────────────────────

    async def archive_reports_directory(
        self,
        reports_dir: str,
        provider: str,
        bucket: str,
        prefix: str = "meta-ads-archive/",
    ) -> dict:
        """Rapor klasöründeki tüm CSV/ZIP dosyalarını buluta yükler."""
        from datetime import date

        dir_path = Path(reports_dir)
        if not dir_path.exists():
            raise CloudExportError(f"Rapor klasörü bulunamadı: {reports_dir}")

        files = list(dir_path.glob("**/*.csv")) + list(dir_path.glob("**/*.zip"))
        if not files:
            return {"uploaded": 0, "files": [], "errors": []}

        date_prefix = f"{prefix}{date.today().isoformat()}/"
        uploaded = []
        errors = []

        for file in files:
            key = date_prefix + file.name
            try:
                result = await self.upload(str(file), bucket, key, provider)
                uploaded.append({"file": file.name, "key": key, "size": result.get("file_size_bytes")})
            except Exception as e:
                errors.append({"file": file.name, "error": str(e)})

        return {"uploaded": len(uploaded), "files": uploaded, "errors": errors}


cloud_export_service = CloudExportService()
