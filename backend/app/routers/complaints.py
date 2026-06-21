"""Complaint intake API — creates cases and initiates lifecycle."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.database import SessionLocal
from app.models import Case, Complaint
from app.services.case_workflow import ensure_checkpoints, link_artifact, transition_case
from app.services.workflow import WorkflowError

router = APIRouter(prefix="/complaints", tags=["complaints"])

_YEAR = datetime.utcnow().year


class ComplaintCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    complainant_name: str
    accused_name: str
    accused_designation: Optional[str] = None
    accused_department: Optional[str] = None
    location: Optional[str] = None
    amount_involved: Optional[float] = 0
    channel: Optional[str] = "Walk-in"
    priority: Optional[str] = "medium"
    language: Optional[str] = "en"
    summary: Optional[str] = None
    has_evidence: Optional[bool] = False
    dsp_id: Optional[str] = None
    dsp_name: Optional[str] = None
    submit_to_verification: Optional[bool] = False


class ComplaintUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    status: Optional[str] = None
    dsp_id: Optional[str] = None
    dsp_name: Optional[str] = None
    summary: Optional[str] = None
    priority: Optional[str] = None


def _next_tracking_id(db) -> str:
    count = db.query(Complaint).count()
    return f"CMP-{_YEAR}-{str(count + 1).zfill(4)}"


def _next_case_tracking(db) -> str:
    count = db.query(Case).count()
    return f"TS-ACB-{_YEAR}-RCT-{str(count + 1).zfill(4)}"


def _to_dict(c: Complaint) -> dict[str, Any]:
    return {
        "id": c.id,
        "trackingId": c.tracking_id,
        "caseId": c.case_id,
        "complainantName": c.complainant_name,
        "accusedName": c.accused_name,
        "accusedDesignation": c.accused_designation,
        "accusedDepartment": c.accused_department,
        "location": c.location,
        "amountInvolved": c.amount_involved or 0,
        "channel": c.channel,
        "priority": c.priority,
        "language": c.language,
        "status": c.status,
        "dspId": c.dsp_id,
        "dspName": c.dsp_name,
        "summary": c.summary,
        "hasEvidence": bool(c.has_evidence),
        "complaintType": c.complaint_type or "initial",
        "submittedOn": c.created_at.isoformat() if c.created_at else None,
        "updatedAt": c.updated_at.isoformat() if c.updated_at else None,
    }


def _create_case_from_complaint(db, complaint: Complaint) -> Case:
    case_id = f"case-{uuid.uuid4().hex[:8]}"
    tracking = _next_case_tracking(db)
    case_number = f"ACB/{_YEAR}/{str(db.query(Case).count() + 1).zfill(3)}"

    case = Case(
        id=case_id,
        case_number=case_number,
        tracking_id=tracking,
        title=f"Trap Case — {complaint.accused_name}",
        type="trap",
        status="active",
        current_phase="complaint" if not complaint.status == "submitted" else "verification",
        phase_substatus="draft" if complaint.status != "submitted" else "pending",
        priority=complaint.priority or "medium",
        language=complaint.language or "en",
        complaint_id=complaint.id,
        dsp_id=complaint.dsp_id,
        dsp_name=complaint.dsp_name,
        accused_name=complaint.accused_name,
        accused_designation=complaint.accused_designation,
        accused_department=complaint.accused_department,
        location=complaint.location,
        amount_involved=complaint.amount_involved or 0,
        complaint_summary=complaint.summary,
        tags=json.dumps(["trap", complaint.priority or "medium"]),
    )
    db.add(case)
    db.flush()
    complaint.case_id = case_id
    ensure_checkpoints(db, case_id, case.current_phase)
    if case.current_phase == "verification":
        transition_case(db, case, to_phase="verification", substatus="pending", action="intake_submit")
    return case


@router.get("", summary="List complaints")
def list_complaints(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
):
    db = SessionLocal()
    try:
        q = db.query(Complaint).order_by(Complaint.created_at.desc())
        if status:
            q = q.filter(Complaint.status == status)
        if priority:
            q = q.filter(Complaint.priority == priority)
        return [_to_dict(c) for c in q.all()]
    finally:
        db.close()


@router.post("", status_code=201, summary="Create draft complaint and case")
def create_complaint(payload: ComplaintCreate):
    db = SessionLocal()
    try:
        cid = f"complaint-{uuid.uuid4().hex[:8]}"
        tracking = _next_tracking_id(db)
        status = "submitted" if payload.submit_to_verification else "draft"
        if payload.dsp_id or payload.dsp_name:
            status = "assigned" if status == "draft" else status

        complaint = Complaint(
            id=cid,
            tracking_id=tracking,
            complainant_name=payload.complainant_name,
            accused_name=payload.accused_name,
            accused_designation=payload.accused_designation,
            accused_department=payload.accused_department,
            location=payload.location,
            amount_involved=payload.amount_involved or 0,
            channel=payload.channel or "Walk-in",
            priority=payload.priority or "medium",
            language=payload.language or "en",
            status=status,
            dsp_id=payload.dsp_id,
            dsp_name=payload.dsp_name,
            summary=payload.summary,
            has_evidence=1 if payload.has_evidence else 0,
            complaint_type="initial",
        )
        db.add(complaint)
        db.flush()

        case = _create_case_from_complaint(db, complaint)

        if payload.submit_to_verification:
            try:
                transition_case(db, case, to_phase="verification", substatus="pending", action="submit_verification")
                complaint.status = "submitted"
            except WorkflowError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e

        db.commit()
        db.refresh(complaint)
        result = _to_dict(complaint)
        result["caseTrackingId"] = case.tracking_id
        return result
    finally:
        db.close()


class FurtherComplaintCreate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    complainant_name: str
    summary: Optional[str] = None
    language: Optional[str] = "en"
    amount_involved: Optional[float] = None
    has_evidence: Optional[bool] = False


@router.get("/by-case/{case_id}", summary="List all complaints linked to a case")
def list_case_complaints(case_id: str):
    db = SessionLocal()
    try:
        case = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        rows = (
            db.query(Complaint)
            .filter(Complaint.case_id == case.id)
            .order_by(Complaint.created_at)
            .all()
        )
        return [_to_dict(c) for c in rows]
    finally:
        db.close()


@router.post("/by-case/{case_id}/further", status_code=201, summary="Add further complaint to existing case")
def add_further_complaint(case_id: str, payload: FurtherComplaintCreate):
    db = SessionLocal()
    try:
        case = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
        cid = f"complaint-{uuid.uuid4().hex[:8]}"
        tracking = _next_tracking_id(db)
        complaint = Complaint(
            id=cid,
            tracking_id=tracking,
            case_id=case.id,
            complainant_name=payload.complainant_name,
            accused_name=case.accused_name or "—",
            accused_designation=case.accused_designation,
            accused_department=case.accused_department,
            location=case.location,
            amount_involved=payload.amount_involved or case.amount_involved or 0,
            language=payload.language or "en",
            status="submitted",
            summary=payload.summary,
            has_evidence=1 if payload.has_evidence else 0,
            complaint_type="further",
        )
        db.add(complaint)
        case.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(complaint)
        return _to_dict(complaint)
    finally:
        db.close()


@router.get("/{complaint_id}", summary="Get complaint")
def get_complaint(complaint_id: str):
    db = SessionLocal()
    try:
        c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Complaint not found")
        return _to_dict(c)
    finally:
        db.close()


@router.patch("/{complaint_id}", summary="Update complaint")
def update_complaint(complaint_id: str, payload: ComplaintUpdate):
    db = SessionLocal()
    try:
        c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Complaint not found")
        data = payload.model_dump(exclude_none=True, by_alias=False)
        for k, v in data.items():
            setattr(c, k, v)
        c.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(c)
        return _to_dict(c)
    finally:
        db.close()


@router.post("/{complaint_id}/submit", summary="Submit complaint to verification phase")
def submit_complaint(complaint_id: str):
    db = SessionLocal()
    try:
        c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
        if not c:
            raise HTTPException(status_code=404, detail="Complaint not found")
        if not c.case_id:
            _create_case_from_complaint(db, c)
        case = db.query(Case).filter(Case.id == c.case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Linked case not found")
        try:
            transition_case(db, case, to_phase="verification", substatus="pending", action="submit_verification")
        except WorkflowError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
        c.status = "submitted"
        c.updated_at = datetime.utcnow()
        db.commit()
        return {"complaint": _to_dict(c), "caseId": case.id, "trackingId": case.tracking_id}
    finally:
        db.close()
