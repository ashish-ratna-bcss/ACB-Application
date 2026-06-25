import json
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.database import SessionLocal
from app.models import MediaRecord

router = APIRouter(prefix="/media-records", tags=["Media Records"])


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class MediaRecordCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    case_id: str
    file_name: Optional[str] = None
    audio_description: Optional[str] = None
    language: Optional[str] = None
    language_name: Optional[str] = None
    target_language: Optional[str] = None
    target_language_name: Optional[str] = None
    task: Optional[str] = "transcribe"
    text: Optional[str] = None
    original_text: Optional[str] = None
    segments: Optional[list[dict]] = []
    original_segments: Optional[list[dict]] = []
    speaker_count: Optional[int] = 0
    diarization: Optional[bool] = False
    processing_time: Optional[float] = None


class MediaRecordResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str
    case_id: str
    file_name: Optional[str] = None
    audio_description: Optional[str] = None
    language: Optional[str] = None
    language_name: Optional[str] = None
    target_language: Optional[str] = None
    target_language_name: Optional[str] = None
    task: Optional[str] = None
    text: Optional[str] = None
    original_text: Optional[str] = None
    segments: list[dict] = []
    original_segments: list[dict] = []
    speaker_count: int = 0
    diarization: bool = False
    processing_time: Optional[float] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _to_response(r: MediaRecord) -> dict[str, Any]:
    return MediaRecordResponse(
        id=r.id,
        case_id=r.case_id,
        file_name=r.file_name,
        audio_description=r.audio_description,
        language=r.language,
        language_name=r.language_name,
        target_language=r.target_language,
        target_language_name=r.target_language_name,
        task=r.task,
        text=r.text,
        original_text=r.original_text,
        segments=json.loads(r.segments) if r.segments else [],
        original_segments=json.loads(r.original_segments) if r.original_segments else [],
        speaker_count=r.speaker_count or 0,
        diarization=bool(r.diarization),
        processing_time=r.processing_time,
        created_at=r.created_at.isoformat() if r.created_at else None,
        updated_at=r.updated_at.isoformat() if r.updated_at else None,
    ).model_dump(by_alias=True)


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("", status_code=201, summary="Save a media transcription record")
def create_media_record(payload: MediaRecordCreate):
    db = SessionLocal()
    try:
        record = MediaRecord(
            id=str(uuid.uuid4()),
            case_id=payload.case_id,
            file_name=payload.file_name,
            audio_description=payload.audio_description,
            language=payload.language,
            language_name=payload.language_name,
            target_language=payload.target_language,
            target_language_name=payload.target_language_name,
            task=payload.task or "transcribe",
            text=payload.text,
            original_text=payload.original_text,
            segments=json.dumps(payload.segments or []),
            original_segments=json.dumps(payload.original_segments or []),
            speaker_count=payload.speaker_count or 0,
            diarization=1 if payload.diarization else 0,
            processing_time=payload.processing_time,
        )
        db.add(record)

        # Log the uploaded media as a chain-of-custody evidence item for the case.
        from app.routers.evidence import create_media_evidence
        create_media_evidence(
            db,
            case_id=payload.case_id,
            file_name=payload.file_name,
            description=payload.audio_description or (payload.text[:160] if payload.text else None),
        )

        db.commit()
        db.refresh(record)
        return _to_response(record)
    finally:
        db.close()


@router.get("", summary="List media records for a case")
def list_media_records(case_id: str = Query(..., description="Case ID to filter by")):
    db = SessionLocal()
    try:
        records = (
            db.query(MediaRecord)
            .filter(MediaRecord.case_id == case_id)
            .order_by(MediaRecord.created_at.desc())
            .all()
        )
        return [_to_response(r) for r in records]
    finally:
        db.close()


@router.get("/{record_id}", summary="Get a single media record")
def get_media_record(record_id: str):
    db = SessionLocal()
    try:
        r = db.query(MediaRecord).filter(MediaRecord.id == record_id).first()
        if not r:
            raise HTTPException(status_code=404, detail="Media record not found")
        return _to_response(r)
    finally:
        db.close()


@router.delete("/{record_id}", status_code=204, summary="Delete a media record")
def delete_media_record(record_id: str):
    db = SessionLocal()
    try:
        r = db.query(MediaRecord).filter(MediaRecord.id == record_id).first()
        if not r:
            raise HTTPException(status_code=404, detail="Media record not found")
        db.delete(r)
        db.commit()
    finally:
        db.close()
