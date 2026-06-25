import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.models import EvidenceItem

router = APIRouter(prefix="/cases", tags=["Evidence"])

AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".aac", ".ogg", ".flac", ".webm", ".opus"}
VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".avi", ".webm"}


def evidence_type_for_file(file_name: Optional[str]) -> str:
    ext = Path(file_name or "").suffix.lower()
    if ext in VIDEO_EXTS:
        return "video"
    if ext in AUDIO_EXTS:
        return "audio"
    return "audio"


def create_media_evidence(
    db: Session,
    case_id: str,
    file_name: Optional[str],
    description: Optional[str],
    uploaded_by: Optional[str] = None,
    file_hash: Optional[str] = None,
) -> EvidenceItem:
    """Log an uploaded speech/media file as a chain-of-custody evidence item."""
    item = EvidenceItem(
        id=str(uuid.uuid4()),
        case_id=case_id,
        evidence_type=evidence_type_for_file(file_name),
        title=file_name or "Media evidence",
        description=description,
        file_hash=file_hash,
        status="logged",
        uploaded_by=uploaded_by,
    )
    db.add(item)
    return item


def _to_response(e: EvidenceItem) -> dict[str, Any]:
    return {
        "id": e.id,
        "caseId": e.case_id,
        "evidenceType": e.evidence_type,
        "title": e.title,
        "description": e.description,
        "fileHash": e.file_hash,
        "status": e.status,
        "uploadedBy": e.uploaded_by,
        "createdAt": e.created_at.isoformat() if e.created_at else None,
        "updatedAt": e.updated_at.isoformat() if e.updated_at else None,
    }


@router.get("/{case_id}/evidence", summary="List evidence items for a case")
def list_evidence(case_id: str):
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        items = (
            db.query(EvidenceItem)
            .filter(EvidenceItem.case_id == case_id)
            .order_by(EvidenceItem.created_at.desc())
            .all()
        )
        return [_to_response(i) for i in items]
    finally:
        db.close()
