"""Case workflow API — state machine transitions and phase data."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from sqlalchemy import func

from app.database import SessionLocal
from app.models import Case
from app.services.case_workflow import (
    get_workflow,
    link_artifact,
    record_approval,
    transition_case,
    update_checkpoint,
    update_phase_data,
)
from app.services.workflow import PHASE_ORDER, WorkflowError, is_phase_locked_for_case

router = APIRouter(prefix="/workflow", tags=["workflow"])


class TransitionRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    to_phase: Optional[str] = None
    substatus: Optional[str] = None
    action: Optional[str] = "advance"
    notes: Optional[str] = None
    actor_id: Optional[str] = "io-001"
    actor_name: Optional[str] = "Insp. D. Prakash Reddy"
    actor_role: Optional[str] = "io"


class CheckpointUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    phase: str
    key: str
    done: bool


class PhaseDataPatch(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    data: dict[str, Any]


class ApprovalRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    approval_type: str
    status: str
    authority: Optional[str] = None
    authority_name: Optional[str] = None
    notes: Optional[str] = None


class ArtifactLink(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    phase: str
    artifact_type: str
    ref_id: str
    title: str


def _case_to_list_item(c: Case) -> dict[str, Any]:
    return {
        "id": c.tracking_id or c.case_number,
        "caseId": c.id,
        "trackingId": c.tracking_id or c.case_number,
        "accused": c.accused_name or "—",
        "designation": c.accused_designation or "",
        "department": c.accused_department or "—",
        "location": c.location or "—",
        "priority": c.priority or "medium",
        "statusVal": c.phase_substatus or "pending",
        "statusLbl": (c.phase_substatus or "pending").replace("_", " ").title(),
        "phase": c.current_phase,
        "firNumber": c.fir_number,
        "amount": c.amount_involved or 0,
        "dspName": c.dsp_name,
        "lastUpdated": c.updated_at.isoformat() if c.updated_at else None,
    }


@router.get("/cases", summary="List cases filtered by workflow phase")
def list_cases_by_phase(
    phase: Optional[str] = Query(None),
    substatus: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
):
    db = SessionLocal()
    try:
        q = db.query(Case).order_by(Case.updated_at.desc())
        if phase:
            q = q.filter(Case.current_phase == phase)
        if substatus:
            q = q.filter(Case.phase_substatus == substatus)
        if priority:
            q = q.filter(Case.priority == priority)
        return [_case_to_list_item(c) for c in q.all()]
    finally:
        db.close()


def _phase_nav_locked(phase: str, counts: dict[str, int]) -> bool:
    if phase == "evidence":
        return (counts.get("investigation", 0) + counts.get("evidence", 0)) == 0
    if phase == "court":
        return (counts.get("evidence", 0) + counts.get("court", 0)) == 0
    return False


@router.get("/phases", summary="Phase definitions and global lock state")
def get_phase_definitions():
    db = SessionLocal()
    try:
        rows = db.query(Case.current_phase, func.count(Case.id)).group_by(Case.current_phase).all()
        counts = {p: n for p, n in rows}
        return {
            "order": PHASE_ORDER,
            "phaseCounts": counts,
            "phases": [
                {
                    "id": p,
                    "locked": _phase_nav_locked(p, counts),
                    "requiresPrior": p in ("evidence", "court"),
                    "caseCount": counts.get(p, 0),
                }
                for p in PHASE_ORDER
            ],
        }
    finally:
        db.close()


@router.get("/cases/{case_id}", summary="Get case workflow state")
def get_case_workflow(case_id: str, view_phase: Optional[str] = Query(None, alias="viewPhase")):
    db = SessionLocal()
    try:
        c = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")
        return get_workflow(db, c, view_phase=view_phase)
    finally:
        db.close()


@router.get("/processing-flow", summary="Full 25-step ACB case processing flow definition")
def get_processing_flow_definition():
    from app.services.case_processing_flow import (
        AI_DRAFT_WORKFLOW,
        CASE_PROCESSING_STEPS,
        build_ai_workflow,
    )
    return {
        "steps": CASE_PROCESSING_STEPS,
        "aiWorkflow": build_ai_workflow(),
        "totalSteps": len(CASE_PROCESSING_STEPS),
        "aiSteps": len(AI_DRAFT_WORKFLOW),
    }


@router.post("/cases/{case_id}/transition", summary="Transition case phase or substatus")
def post_transition(case_id: str, payload: TransitionRequest):
    db = SessionLocal()
    try:
        c = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")
        try:
            transition_case(
                db, c,
                to_phase=payload.to_phase,
                substatus=payload.substatus,
                action=payload.action or "advance",
                notes=payload.notes,
                actor_id=payload.actor_id or "io-001",
                actor_name=payload.actor_name or "Insp. D. Prakash Reddy",
                actor_role=payload.actor_role or "io",
            )
            db.commit()
            db.refresh(c)
            return get_workflow(db, c)
        except WorkflowError as e:
            raise HTTPException(status_code=400, detail={"message": str(e), "code": e.code}) from e
    finally:
        db.close()


@router.patch("/cases/{case_id}/checkpoints", summary="Update phase checkpoint")
def patch_checkpoint(case_id: str, payload: CheckpointUpdate):
    db = SessionLocal()
    try:
        c = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")
        try:
            update_checkpoint(db, c.id, payload.phase, payload.key, payload.done)
            db.commit()
            return get_workflow(db, c)
        except WorkflowError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    finally:
        db.close()


@router.patch("/cases/{case_id}/phase-data", summary="Merge phase-specific JSON data")
def patch_phase_data(case_id: str, payload: PhaseDataPatch):
    db = SessionLocal()
    try:
        c = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")
        update_phase_data(db, c, payload.data)
        db.commit()
        db.refresh(c)
        return get_workflow(db, c)
    finally:
        db.close()


@router.post("/cases/{case_id}/approvals", summary="Record approval decision")
def post_approval(case_id: str, payload: ApprovalRequest):
    db = SessionLocal()
    try:
        c = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")
        record_approval(
            db, c.id,
            payload.approval_type,
            payload.status,
            authority=payload.authority,
            authority_name=payload.authority_name,
            notes=payload.notes,
        )
        if payload.approval_type == "trap" and payload.status == "approved":
            transition_case(db, c, substatus="approved")
        if payload.approval_type == "fir" and payload.status == "approved":
            transition_case(db, c, substatus="fir_registered")
        db.commit()
        db.refresh(c)
        return get_workflow(db, c)
    finally:
        db.close()


@router.post("/cases/{case_id}/artifacts", summary="Link document/media artifact to phase")
def post_artifact(case_id: str, payload: ArtifactLink):
    db = SessionLocal()
    try:
        c = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")
        link_artifact(db, c.id, payload.phase, payload.artifact_type, payload.ref_id, payload.title)
        db.commit()
        return get_workflow(db, c)
    finally:
        db.close()


@router.get("/cases/{case_id}/access/{phase}", summary="Check if phase is accessible for case")
def check_phase_access(case_id: str, phase: str):
    db = SessionLocal()
    try:
        c = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not c:
            raise HTTPException(status_code=404, detail="Case not found")
        current = c.current_phase or "complaint"
        locked = is_phase_locked_for_case(current, phase)
        return {"phase": phase, "accessible": not locked, "currentPhase": current}
    finally:
        db.close()
