"""Dashboard KPIs — operational + AI pipeline metrics."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter
from sqlalchemy import func

from app.database import SessionLocal
from app.models import Approval, Case, Complaint, Document, EvidenceItem

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/kpis", summary="Aggregated dashboard KPIs")
def get_dashboard_kpis():
    db = SessionLocal()
    try:
        total_cases = db.query(Case).count()
        active_traps = db.query(Case).filter(Case.current_phase == "trap").count()
        pending_approvals = db.query(Approval).filter(Approval.status == "pending").count()
        pending_ho = db.query(Case).filter(
            Case.current_phase == "approval",
            Case.phase_substatus.in_(["pending", "submitted"]),
        ).count()

        convictions = db.query(Case).filter(Case.judicial_outcome == "convicted").count()
        acquittals = db.query(Case).filter(Case.judicial_outcome == "acquitted").count()
        resolved = convictions + acquittals
        conviction_rate = round((convictions / resolved) * 100) if resolved else 0

        total_docs = db.query(Document).count()
        processing_docs = db.query(Document).filter(Document.status == "processing").count()
        failed_docs = db.query(Document).filter(Document.status == "failed").count()
        completed_docs = db.query(Document).filter(Document.status == "completed").count()

        total_complaints = db.query(Complaint).count()
        draft_complaints = db.query(Complaint).filter(Complaint.status == "draft").count()

        phase_distribution = (
            db.query(Case.current_phase, func.count(Case.id))
            .group_by(Case.current_phase)
            .all()
        )
        phase_counts = {p: n for p, n in phase_distribution}

        recent_transitions = (
            db.query(Case)
            .order_by(Case.updated_at.desc())
            .limit(8)
            .all()
        )

        return {
            "operational": {
                "totalCases": total_cases,
                "activeTraps": active_traps,
                "pendingApprovals": pending_approvals + pending_ho,
                "convictionRate": conviction_rate,
                "convictions": convictions,
                "acquittals": acquittals,
                "totalComplaints": total_complaints,
                "draftComplaints": draft_complaints,
            },
            "pipeline": {
                "totalDocuments": total_docs,
                "processingDocuments": processing_docs,
                "failedDocuments": failed_docs,
                "completedDocuments": completed_docs,
            },
            "phaseDistribution": [
                {"phase": p, "count": phase_counts.get(p, 0)}
                for p in ["complaint", "verification", "approval", "trap", "remand", "investigation", "evidence", "court", "prosecution"]
            ],
            "recentActivity": [
                {
                    "caseId": c.tracking_id or c.case_number,
                    "phase": c.current_phase,
                    "substatus": c.phase_substatus,
                    "title": f"Case updated — {c.current_phase.replace('_', ' ').title()}",
                    "time": c.updated_at.isoformat() if c.updated_at else None,
                }
                for c in recent_transitions
            ],
            "generatedAt": datetime.utcnow().isoformat(),
        }
    finally:
        db.close()
