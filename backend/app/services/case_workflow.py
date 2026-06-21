"""Workflow operations: transitions, checkpoints, artifacts."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    Approval,
    AuditLog,
    Case,
    Complaint,
    PhaseArtifact,
    PhaseCheckpoint,
    PhaseTransition,
)
from app.services.case_processing_flow import build_ai_workflow, build_processing_flow
from app.services.report_templates import build_phase_panel, get_templates_for_phase
from app.services.workflow import (
    PHASE_ORDER,
    PHASE_SUBSTATUSES,
    WorkflowError,
    build_phase_tracker,
    default_checkpoints,
    validate_transition,
)


def _audit(
    db: Session,
    case_id: str,
    action: str,
    *,
    user_id: str = "system",
    user_name: str = "System",
    resource: str | None = None,
    details: str | None = None,
) -> None:
    db.add(AuditLog(
        case_id=case_id,
        user_id=user_id,
        user_name=user_name,
        action=action,
        resource=resource,
        details=details,
    ))


def ensure_checkpoints(db: Session, case_id: str, phase: str) -> list[PhaseCheckpoint]:
    existing = (
        db.query(PhaseCheckpoint)
        .filter(PhaseCheckpoint.case_id == case_id, PhaseCheckpoint.phase == phase)
        .all()
    )
    if existing:
        return existing
    rows = []
    for cp in default_checkpoints(phase):
        row = PhaseCheckpoint(
            case_id=case_id,
            phase=phase,
            key=cp["key"],
            label=cp["label"],
            done=0,
        )
        db.add(row)
        rows.append(row)
    db.flush()
    return rows


def get_workflow(db: Session, case: Case, *, view_phase: str | None = None) -> dict[str, Any]:
    phase = case.current_phase or "complaint"
    display_phase = view_phase or phase
    substatus = case.phase_substatus or "draft"
    checkpoints = ensure_checkpoints(db, case.id, display_phase)
    transitions = (
        db.query(PhaseTransition)
        .filter(PhaseTransition.case_id == case.id)
        .order_by(PhaseTransition.created_at.desc())
        .limit(20)
        .all()
    )
    artifacts = (
        db.query(PhaseArtifact)
        .filter(PhaseArtifact.case_id == case.id)
        .order_by(PhaseArtifact.created_at.desc())
        .all()
    )
    approvals = (
        db.query(Approval)
        .filter(Approval.case_id == case.id)
        .order_by(Approval.created_at.desc())
        .all()
    )
    phase_data = json.loads(case.phase_data) if case.phase_data else {}
    phase_panel = build_phase_panel(db, case, display_phase)
    report_templates = get_templates_for_phase(db, display_phase, include_structure=True)

    complaints = (
        db.query(Complaint)
        .filter(Complaint.case_id == case.id)
        .order_by(Complaint.created_at)
        .all()
    )

    return {
        "caseId": case.id,
        "trackingId": case.tracking_id or case.case_number,
        "currentPhase": phase,
        "phaseSubstatus": substatus,
        "phases": build_phase_tracker(phase, substatus),
        "checkpoints": [
            {"key": c.key, "label": c.label, "done": bool(c.done), "phase": c.phase}
            for c in checkpoints
        ],
        "transitions": [
            {
                "fromPhase": t.from_phase,
                "toPhase": t.to_phase,
                "action": t.action,
                "notes": t.notes,
                "actorName": t.actor_name,
                "actorRole": t.actor_role,
                "createdAt": t.created_at.isoformat() if t.created_at else None,
            }
            for t in transitions
        ],
        "artifacts": [
            {
                "id": a.id,
                "phase": a.phase,
                "artifactType": a.artifact_type,
                "refId": a.ref_id,
                "title": a.title,
                "status": a.status,
            }
            for a in artifacts
        ],
        "approvals": [
            {
                "id": a.id,
                "approvalType": a.approval_type,
                "status": a.status,
                "authority": a.authority,
                "authorityName": a.authority_name,
                "decidedAt": a.decided_at.isoformat() if a.decided_at else None,
            }
            for a in approvals
        ],
        "phaseData": phase_data,
        "phasePanel": phase_panel,
        "reportTemplates": report_templates,
        "processingFlow": build_processing_flow(phase),
        "phaseFlowSteps": build_processing_flow(phase, phase_filter=display_phase),
        "aiDraftWorkflow": build_ai_workflow(),
        "complaints": [
            {
                "id": c.id,
                "trackingId": c.tracking_id,
                "complainantName": c.complainant_name,
                "complaintType": c.complaint_type or "initial",
                "language": c.language,
                "status": c.status,
                "summary": c.summary,
                "hasEvidence": bool(c.has_evidence),
                "submittedOn": c.created_at.isoformat() if c.created_at else None,
            }
            for c in complaints
        ],
        "allowedSubstatuses": PHASE_SUBSTATUSES.get(phase, []),
        "nextPhase": _next_phase(phase),
    }


def _next_phase(phase: str) -> str | None:
    try:
        idx = PHASE_ORDER.index(phase)
    except ValueError:
        return None
    if idx + 1 < len(PHASE_ORDER):
        return PHASE_ORDER[idx + 1]
    return None


def transition_case(
    db: Session,
    case: Case,
    *,
    to_phase: str | None = None,
    substatus: str | None = None,
    action: str = "advance",
    notes: str | None = None,
    actor_id: str = "io-001",
    actor_name: str = "Insp. D. Prakash Reddy",
    actor_role: str = "io",
    force: bool = False,
) -> Case:
    from_phase = case.current_phase or "complaint"
    target = to_phase or _next_phase(from_phase)

    if target and target != from_phase:
        validate_transition(from_phase, target, role=actor_role, force=force)
        db.add(PhaseTransition(
            case_id=case.id,
            from_phase=from_phase,
            to_phase=target,
            action=action,
            notes=notes,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_role=actor_role,
        ))
        case.current_phase = target
        default_sub = PHASE_SUBSTATUSES.get(target, ["active"])[0]
        case.phase_substatus = substatus or default_sub
        ensure_checkpoints(db, case.id, target)
        _audit(db, case.id, f"phase_transition:{from_phase}->{target}", user_id=actor_id, user_name=actor_name, details=notes)
    elif substatus:
        subs = PHASE_SUBSTATUSES.get(from_phase, [])
        if subs and substatus not in subs and not force:
            raise WorkflowError(f"Invalid substatus '{substatus}' for phase '{from_phase}'")
        case.phase_substatus = substatus
        _audit(db, case.id, f"substatus_update:{substatus}", user_id=actor_id, user_name=actor_name)

    case.updated_at = datetime.utcnow()
    db.flush()
    return case


def update_checkpoint(
    db: Session,
    case_id: str,
    phase: str,
    key: str,
    done: bool,
    *,
    actor_name: str = "Insp. D. Prakash Reddy",
) -> PhaseCheckpoint:
    row = (
        db.query(PhaseCheckpoint)
        .filter(PhaseCheckpoint.case_id == case_id, PhaseCheckpoint.phase == phase, PhaseCheckpoint.key == key)
        .first()
    )
    if not row:
        raise WorkflowError(f"Checkpoint '{key}' not found for phase '{phase}'")
    row.done = 1 if done else 0
    row.updated_at = datetime.utcnow()
    _audit(db, case_id, f"checkpoint:{key}={'done' if done else 'undone'}", user_name=actor_name)
    return row


def link_artifact(
    db: Session,
    case_id: str,
    phase: str,
    artifact_type: str,
    ref_id: str,
    title: str,
) -> PhaseArtifact:
    art = PhaseArtifact(
        case_id=case_id,
        phase=phase,
        artifact_type=artifact_type,
        ref_id=ref_id,
        title=title,
    )
    db.add(art)
    _audit(db, case_id, f"artifact_linked:{artifact_type}", resource=ref_id, details=title)
    return art


def record_approval(
    db: Session,
    case_id: str,
    approval_type: str,
    status: str,
    *,
    authority: str | None = None,
    authority_name: str | None = None,
    notes: str | None = None,
) -> Approval:
    row = Approval(
        case_id=case_id,
        approval_type=approval_type,
        status=status,
        authority=authority,
        authority_name=authority_name,
        decision_notes=notes,
        decided_at=datetime.utcnow() if status in ("approved", "rejected") else None,
    )
    db.add(row)
    _audit(db, case_id, f"approval:{approval_type}:{status}", details=notes)
    return row


def update_phase_data(db: Session, case: Case, patch: dict[str, Any]) -> Case:
    current = json.loads(case.phase_data) if case.phase_data else {}
    current.update(patch)
    case.phase_data = json.dumps(current)
    case.updated_at = datetime.utcnow()
    return case
