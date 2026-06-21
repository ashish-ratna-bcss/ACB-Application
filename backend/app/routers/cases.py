import json
import re
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Case

router = APIRouter(prefix="/cases", tags=["cases"])

_YEAR = datetime.utcnow().year


# ── Pydantic schemas (camelCase in/out for frontend compat) ─────────────────

class CaseBase(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: str
    type: str
    fir_number: Optional[str] = None
    status: Optional[str] = "active"
    officer_id: Optional[str] = None
    officer_name: Optional[str] = None
    officer_department: Optional[str] = None
    accused_name: Optional[str] = None
    accused_designation: Optional[str] = None
    accused_department: Optional[str] = None
    accused_contact: Optional[str] = None
    complaint_summary: Optional[str] = None
    incident_date: Optional[str] = None
    location: Optional[str] = None
    amount_involved: Optional[float] = 0
    tags: Optional[list[str]] = []


class CaseCreate(CaseBase):
    id: Optional[str] = None
    case_number: Optional[str] = None


class CaseUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    title: Optional[str] = None
    type: Optional[str] = None
    fir_number: Optional[str] = None
    status: Optional[str] = None
    officer_id: Optional[str] = None
    officer_name: Optional[str] = None
    officer_department: Optional[str] = None
    accused_name: Optional[str] = None
    accused_designation: Optional[str] = None
    accused_department: Optional[str] = None
    accused_contact: Optional[str] = None
    complaint_summary: Optional[str] = None
    incident_date: Optional[str] = None
    location: Optional[str] = None
    amount_involved: Optional[float] = None
    tags: Optional[list[str]] = None


class CaseResponse(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    id: str
    case_number: str
    tracking_id: Optional[str] = None
    title: str
    type: str
    fir_number: Optional[str] = None
    status: str
    current_phase: Optional[str] = "complaint"
    phase_substatus: Optional[str] = "draft"
    priority: Optional[str] = "medium"
    language: Optional[str] = "en"
    officer_id: Optional[str] = None
    officer_name: Optional[str] = None
    officer_department: Optional[str] = None
    accused_name: Optional[str] = None
    accused_designation: Optional[str] = None
    accused_department: Optional[str] = None
    accused_contact: Optional[str] = None
    complaint_summary: Optional[str] = None
    incident_date: Optional[str] = None
    location: Optional[str] = None
    amount_involved: float = 0
    documents_count: int = 0
    drafts_count: int = 0
    tags: list[str] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _to_response(c: Case) -> dict[str, Any]:
    return CaseResponse(
        id=c.id,
        case_number=c.case_number,
        tracking_id=getattr(c, "tracking_id", None),
        title=c.title,
        type=c.type,
        fir_number=c.fir_number,
        status=c.status or "active",
        current_phase=getattr(c, "current_phase", None) or "complaint",
        phase_substatus=getattr(c, "phase_substatus", None) or "draft",
        priority=getattr(c, "priority", None) or "medium",
        language=getattr(c, "language", None) or "en",
        officer_id=c.officer_id,
        officer_name=c.officer_name,
        officer_department=c.officer_department,
        accused_name=c.accused_name,
        accused_designation=c.accused_designation,
        accused_department=c.accused_department,
        accused_contact=c.accused_contact,
        complaint_summary=c.complaint_summary,
        incident_date=c.incident_date,
        location=c.location,
        amount_involved=c.amount_involved or 0,
        documents_count=c.documents_count or 0,
        drafts_count=c.drafts_count or 0,
        tags=json.loads(c.tags) if c.tags else [],
        created_at=c.created_at.isoformat() if c.created_at else None,
        updated_at=c.updated_at.isoformat() if c.updated_at else None,
    ).model_dump(by_alias=True)


def _next_case_number(db: Session) -> str:
    count = db.query(Case).count()
    return f"ACB/{_YEAR}/{str(count + 1).zfill(3)}"


def _safe_id(raw: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "-", raw)


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", summary="List all cases")
def list_cases():
    db = SessionLocal()
    try:
        cases = db.query(Case).order_by(Case.created_at.desc()).all()
        return [_to_response(c) for c in cases]
    finally:
        db.close()


@router.post("", status_code=201, summary="Create a case")
def create_case(payload: CaseCreate):
    db = SessionLocal()
    try:
        case_id = payload.id or f"case-{_safe_id(str(uuid.uuid4())[:8])}"
        case_number = payload.case_number or _next_case_number(db)

        if db.query(Case).filter(Case.id == case_id).first():
            raise HTTPException(status_code=409, detail=f"Case '{case_id}' already exists")

        c = Case(
            id=case_id,
            case_number=case_number,
            title=payload.title,
            type=payload.type,
            fir_number=payload.fir_number,
            status=payload.status or "active",
            officer_id=payload.officer_id,
            officer_name=payload.officer_name,
            officer_department=payload.officer_department,
            accused_name=payload.accused_name,
            accused_designation=payload.accused_designation,
            accused_department=payload.accused_department,
            accused_contact=payload.accused_contact,
            complaint_summary=payload.complaint_summary,
            incident_date=payload.incident_date,
            location=payload.location,
            amount_involved=payload.amount_involved or 0,
            tags=json.dumps(payload.tags or []),
        )
        db.add(c)
        db.commit()
        db.refresh(c)
        return _to_response(c)
    finally:
        db.close()


@router.get("/{case_id}", summary="Get a single case")
def get_case(case_id: str):
    db = SessionLocal()
    try:
        c = db.query(Case).filter(Case.id == case_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")
        return _to_response(c)
    finally:
        db.close()


@router.patch("/{case_id}", summary="Partially update a case")
def update_case(case_id: str, payload: CaseUpdate):
    db = SessionLocal()
    try:
        c = db.query(Case).filter(Case.id == case_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")

        data = payload.model_dump(exclude_none=True, by_alias=False)
        for field, value in data.items():
            if field == "tags":
                setattr(c, field, json.dumps(value))
            else:
                setattr(c, field, value)
        c.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(c)
        return _to_response(c)
    finally:
        db.close()


@router.delete("/{case_id}", status_code=204, summary="Delete a case")
def delete_case(case_id: str):
    db = SessionLocal()
    try:
        c = db.query(Case).filter(Case.id == case_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")
        db.delete(c)
        db.commit()
    finally:
        db.close()
