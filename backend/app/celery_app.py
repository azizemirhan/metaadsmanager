# -*- coding: utf-8 -*-
"""Celery uygulaması: RabbitMQ broker, Redis result backend."""

from celery import Celery
from app import config

app = Celery(
    "meta_ads",
    broker=config.CELERY_BROKER_URL,
    backend=config.CELERY_RESULT_BACKEND,
    include=["app.tasks"],
)
app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_track_started=True,
    beat_schedule={
        # Akıllı uyarı sistemi - Her 15 dakikada bir çalışır
        "check-alert-rules": {
            "task": "app.tasks.check_alert_rules_task",
            "schedule": 900.0,  # 15 dakika
            "options": {"expires": 600},
        },
        # Zamanlanmış raporlar - Her dakika kontrol et
        "check-scheduled-reports": {
            "task": "app.tasks.check_scheduled_reports_task",
            "schedule": 60.0,  # 1 dakika
            "options": {"expires": 30},
        },
    },
)
