"""Application settings — AI provider, notifications, preferences."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.database import SessionLocal
from app.models import AppSetting, AuditLog

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS: dict[str, Any] = {
    "ai_provider": "local",
    "ai_model": "qwen2.5",
    "cloud_api_key_set": False,
    "pipeline_notify_threshold": 100,
    "language_preference": "en",
    "theme": "light",
    "notification_case_updates": True,
    "notification_pipeline_complete": True,
    "notification_draft_generated": True,
    "notification_review_reminders": False,
}


class SettingsPatch(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    pipeline_notify_threshold: Optional[int] = None
    language_preference: Optional[str] = None
    theme: Optional[str] = None
    notification_case_updates: Optional[bool] = None
    notification_pipeline_complete: Optional[bool] = None
    notification_draft_generated: Optional[bool] = None
    notification_review_reminders: Optional[bool] = None


def _load_settings(db) -> dict[str, Any]:
    result = dict(DEFAULTS)
    rows = db.query(AppSetting).all()
    for row in rows:
        try:
            result[row.key] = json.loads(row.value)
        except (json.JSONDecodeError, TypeError):
            result[row.key] = row.value
    return result


def _save_setting(db, key: str, value: Any) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    serialized = json.dumps(value)
    if row:
        row.value = serialized
        row.updated_at = datetime.utcnow()
    else:
        db.add(AppSetting(key=key, value=serialized))


@router.get("", summary="Get application settings")
def get_settings():
    db = SessionLocal()
    try:
        return _load_settings(db)
    finally:
        db.close()


@router.patch("", summary="Update application settings")
def patch_settings(payload: SettingsPatch):
    db = SessionLocal()
    try:
        data = payload.model_dump(exclude_none=True, by_alias=False)
        for key, value in data.items():
            _save_setting(db, key, value)
        db.add(AuditLog(
            action="settings_updated",
            details=json.dumps(list(data.keys())),
            user_name="Insp. D. Prakash Reddy",
        ))
        db.commit()
        return _load_settings(db)
    finally:
        db.close()
