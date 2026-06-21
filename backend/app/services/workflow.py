"""Case phase state machine — strict lifecycle for trap case management."""

from __future__ import annotations

from datetime import datetime
from typing import Any

# Ordered lifecycle phases (matches functional spec state diagram)
PHASE_ORDER: list[str] = [
    "complaint",
    "verification",
    "approval",
    "trap",
    "remand",
    "investigation",
    "evidence",
    "court",
    "prosecution",
]

PHASE_LABELS: dict[str, str] = {
    "complaint": "Complaint",
    "verification": "Verification",
    "approval": "FIR / Approval",
    "trap": "Trap Operations",
    "remand": "Remand",
    "investigation": "Investigation",
    "evidence": "Evidence",
    "court": "Court",
    "prosecution": "Prosecution",
}

# Phases that require prior phases to be completed before access
PHASE_PREREQUISITES: dict[str, list[str]] = {
    "verification": ["complaint"],
    "approval": ["verification"],
    "trap": ["approval"],
    "remand": ["trap"],
    "investigation": ["remand"],
    "evidence": ["investigation"],
    "court": ["evidence"],
    "prosecution": ["court"],
}

# Allowed forward transitions (one step or explicit jump when completing phase)
ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "complaint": ["verification"],
    "verification": ["approval"],
    "approval": ["trap"],
    "trap": ["remand"],
    "remand": ["investigation"],
    "investigation": ["evidence"],
    "evidence": ["court"],
    "court": ["prosecution"],
    "prosecution": [],
}

# Sub-status options per phase
PHASE_SUBSTATUSES: dict[str, list[str]] = {
    "complaint": ["draft", "assigned", "submitted"],
    "verification": ["pending", "in_progress", "report_submitted"],
    "approval": ["pending", "submitted", "approved", "rejected", "fir_registered"],
    "trap": ["planning", "scheduled", "executed"],
    "remand": ["pending", "diary_generated", "custody_active", "bail_applied"],
    "investigation": ["active", "evidence_collation", "charge_sheet_prep"],
    "evidence": ["logged", "secured", "archived"],
    "court": ["pre_trial", "hearing", "closed"],
    "prosecution": ["preparing", "filed", "trial", "convicted", "acquitted", "dismissed"],
}

# Role-gated transitions (simplified RBAC until auth is wired)
ROLE_TRANSITIONS: dict[str, set[str]] = {
    "io": {"complaint", "verification", "trap", "remand", "investigation", "evidence"},
    "dsp": {"verification", "approval", "investigation"},
    "ho": {"approval", "prosecution"},
    "admin": set(PHASE_ORDER),
}

DEFAULT_CHECKPOINTS: dict[str, list[dict[str, str]]] = {
    "complaint": [
        {"key": "initial_complaint", "label": "Initial complaint recorded (Step 1)"},
        {"key": "dsp_assigned", "label": "Submitted to DSP"},
        {"key": "further_complaint", "label": "Further complaint recorded (Step 4, if applicable)"},
        {"key": "complainant_profile", "label": "Complainant profile captured"},
    ],
    "verification": [
        {"key": "verification_report", "label": "Verification report prepared (Step 2)"},
        {"key": "av_evidence_attached", "label": "Audio/video evidence attached"},
        {"key": "verbatim_prepared", "label": "Verbatim transcript prepared (Step 3)"},
        {"key": "demand_confirmed", "label": "Demand independently confirmed"},
    ],
    "approval": [
        {"key": "trap_permission_submitted", "label": "Trap permission note submitted to HO (Step 5)"},
        {"key": "ho_approval_received", "label": "Head Office approval received (Step 6)"},
        {"key": "fir_registered", "label": "FIR registered — same day as trap (Step 7)"},
        {"key": "note_file_updated", "label": "Internal note file updated"},
    ],
    "trap": [
        {"key": "mr1_complete", "label": "Mediators Report-I complete (Step 8)"},
        {"key": "trap_executed", "label": "Trap executed with pre-arranged signal (Step 9)"},
        {"key": "mr2_complete", "label": "Mediators Report-II complete (Step 9)"},
        {"key": "scene_sketch_seizure", "label": "Scene sketch & seizure memo prepared"},
        {"key": "mr3_if_applicable", "label": "Mediators Report-III (Step 10, if applicable)"},
    ],
    "remand": [
        {"key": "remand_diary", "label": "Remand case diary compiled (Step 11)"},
        {"key": "covering_letters", "label": "Covering letters sent to court (Step 12)"},
        {"key": "post_remand_letters", "label": "Entrustment, ratification & preliminary report (Step 13)"},
        {"key": "radio_initial", "label": "Initial radio message sent (Step 14)"},
        {"key": "radio_followup", "label": "48-hour follow-up radio message (Step 15)"},
    ],
    "investigation": [
        {"key": "suspension_received", "label": "Suspension order received (Step 16)"},
        {"key": "plan_of_action", "label": "Plan of action submitted to HO (Step 17)"},
        {"key": "court_statements_164", "label": "Sec. 164 court statements recorded (Step 18)"},
        {"key": "reimbursement_processed", "label": "Trap money reimbursement processed (Step 19)"},
    ],
    "evidence": [
        {"key": "fsl_submitted", "label": "Evidence sent for FSL examination (Step 24)"},
        {"key": "fsl_report_received", "label": "FSL report received"},
        {"key": "chain_logged", "label": "Chain of custody logged"},
    ],
    "court": [
        {"key": "bail_petition_filed", "label": "First bail petition filed (Step 20)"},
        {"key": "bail_counter_filed", "label": "Bail counter filed (Step 21)"},
        {"key": "bail_order", "label": "Release on bail / conditions (Step 22)"},
        {"key": "form_66_submitted", "label": "Form 66 submitted with CGR (Step 23)"},
    ],
    "prosecution": [
        {"key": "dfr_prepared", "label": "Draft Final Report prepared (Step 25)"},
        {"key": "charge_sheet_drafted", "label": "Draft charge sheet prepared"},
        {"key": "memo_evidence", "label": "Memo of evidence compiled"},
        {"key": "pp_review", "label": "Public Prosecutor review completed"},
        {"key": "sanction_order", "label": "Model sanction order prepared"},
    ],
}


class WorkflowError(Exception):
    def __init__(self, message: str, code: str = "invalid_transition"):
        super().__init__(message)
        self.code = code


def phase_index(phase: str) -> int:
    try:
        return PHASE_ORDER.index(phase)
    except ValueError:
        raise WorkflowError(f"Unknown phase: {phase}", "unknown_phase")


def is_phase_accessible(current_phase: str, target_phase: str) -> bool:
    """A phase tab is accessible if the case has reached it or passed it."""
    return phase_index(current_phase) >= phase_index(target_phase)


def is_phase_locked_for_case(current_phase: str, target_phase: str) -> bool:
    """Evidence/Court-style gating: locked until case reaches prerequisite phase."""
    if is_phase_accessible(current_phase, target_phase):
        return False
    prereqs = PHASE_PREREQUISITES.get(target_phase, [])
    if not prereqs:
        return phase_index(current_phase) < phase_index(target_phase)
    return any(phase_index(current_phase) < phase_index(p) for p in prereqs)


def validate_transition(
    from_phase: str,
    to_phase: str,
    *,
    role: str = "io",
    force: bool = False,
) -> None:
    if from_phase == to_phase:
        return
    if to_phase not in ALLOWED_TRANSITIONS.get(from_phase, []):
        if not force:
            raise WorkflowError(
                f"Cannot transition from '{from_phase}' to '{to_phase}'",
                "invalid_transition",
            )
    allowed_roles = ROLE_TRANSITIONS.get(role, ROLE_TRANSITIONS["io"])
    if to_phase not in allowed_roles and not force:
        raise WorkflowError(
            f"Role '{role}' cannot advance case to '{to_phase}'",
            "forbidden",
        )


def derive_phase_status(case_phase: str, case_substatus: str | None, active_phase: str) -> str:
    """UI status: completed | inprogress | notstarted | pending."""
    ci = phase_index(case_phase)
    ai = phase_index(active_phase)
    if ai < ci:
        return "completed"
    if ai == ci:
        if case_substatus in ("pending", "submitted", "draft"):
            return "pending" if case_substatus == "pending" else "inprogress"
        return "inprogress"
    return "notstarted"


def build_phase_tracker(current_phase: str, current_substatus: str | None = None) -> list[dict[str, Any]]:
    """Build phase list with status for UI tracker."""
    result = []
    ci = phase_index(current_phase)
    for i, pid in enumerate(PHASE_ORDER):
        if i < ci:
            status = "completed"
        elif i == ci:
            status = "inprogress"
            if current_substatus in ("pending", "submitted", "draft", "planning"):
                status = "pending" if current_substatus == "pending" else "inprogress"
        else:
            status = "notstarted"
        result.append({
            "id": pid,
            "label": PHASE_LABELS[pid],
            "status": status,
            "substatus": current_substatus if i == ci else None,
            "locked": is_phase_locked_for_case(current_phase, pid) if i > ci else False,
        })
    return result


def default_checkpoints(phase: str) -> list[dict[str, Any]]:
    return [
        {"key": c["key"], "label": c["label"], "done": False}
        for c in DEFAULT_CHECKPOINTS.get(phase, [])
    ]
