"""ACB trap case processing flow — 25 lifecycle steps and AI-assisted draft workflow."""

from __future__ import annotations

from typing import Any

# ── 25-step case processing flow (from ACB Case Processing Flow document) ─────

CASE_PROCESSING_STEPS: list[dict[str, Any]] = [
    {
        "step": 1,
        "id": "initial_complaint",
        "stage": "Complaint Received",
        "activity": "Complainant submits initial complaint (may be draft, without supporting evidence) to the DSP.",
        "documents": ["Complaint", "complainant details", "accused officer details", "alleged demand"],
        "templateIds": ["complaint_statement"],
        "phase": "complaint",
    },
    {
        "step": 2,
        "id": "verification",
        "stage": "Verification",
        "activity": "DSP initiates verification. Inspector verifies authenticity via field verification or civilian approach.",
        "documents": ["Verification report", "audio/video proof", "notes"],
        "templateIds": ["verification_report"],
        "phase": "verification",
    },
    {
        "step": 3,
        "id": "verbatim_preparation",
        "stage": "Verbatim Preparation",
        "activity": "Audio/video recordings converted to text. Telugu/English verbatim generated and linked to media.",
        "documents": ["Transcript linked to media file"],
        "templateIds": ["verbatim_transcript"],
        "phase": "verification",
    },
    {
        "step": 4,
        "id": "further_complaint",
        "stage": "Further Complaint",
        "activity": "Detailed supplementary complaint may be recorded after verification in English or Telugu.",
        "documents": ["Further complaint", "language metadata", "translation if needed"],
        "templateIds": ["further_complaint"],
        "phase": "complaint",
        "optional": True,
    },
    {
        "step": 5,
        "id": "trap_permission",
        "stage": "Trap Permission",
        "activity": "Case note with complaint, verification report and evidence sent to Head Office for trap approval.",
        "documents": ["Trap permission note", "evidence bundle"],
        "templateIds": ["trap_permission_note", "internal_note_file"],
        "phase": "approval",
    },
    {
        "step": 6,
        "id": "approval_received",
        "stage": "Approval Received",
        "activity": "Head Office grants permission to proceed with the trap operation.",
        "documents": ["HO approval order", "trap permission confirmation"],
        "templateIds": ["internal_note_file"],
        "phase": "approval",
    },
    {
        "step": 7,
        "id": "fir_registration",
        "stage": "FIR Registration",
        "activity": "FIR registered based on complaint, verification and evidence — same day as trap.",
        "documents": ["FIR", "supporting records"],
        "templateIds": ["fir"],
        "phase": "approval",
    },
    {
        "step": 8,
        "id": "pre_trap_mr1",
        "stage": "Pre-Trap / MR-1",
        "activity": "Complainant instructed and prepared; mediators involved; currency serial numbers recorded; chemical process applied.",
        "documents": ["MR-1", "mediator details", "tainted currency list", "instructions"],
        "templateIds": ["mediators_report_1"],
        "phase": "trap",
    },
    {
        "step": 9,
        "id": "post_trap_mr2",
        "stage": "Post-Trap / MR-2",
        "activity": "Trap executed; signal given; recovery, chemical test, seizure, scene sketch and A/V evidence documented.",
        "documents": ["MR-2", "recovery details", "test results", "seizure memo", "scene sketch"],
        "templateIds": ["mediators_report_2", "seizure_memo", "scene_sketch"],
        "phase": "trap",
    },
    {
        "step": 10,
        "id": "mr3_if_applicable",
        "stage": "MR-3 If Applicable",
        "activity": "Prepared only when bribe accepted at a location other than the AO's office.",
        "documents": ["Additional mediator report (MR-3)"],
        "templateIds": ["mediators_report_3"],
        "phase": "trap",
        "optional": True,
    },
    {
        "step": 11,
        "id": "remand_case_diary",
        "stage": "Remand Case Diary",
        "activity": "Consolidates initial complaint, further complaint(s), FIR, MR-1, MR-2 and supporting evidence.",
        "documents": ["Remand report", "case diary bundle"],
        "templateIds": ["remand_case_diary"],
        "phase": "remand",
    },
    {
        "step": 12,
        "id": "covering_letters",
        "stage": "Covering Letters",
        "activity": "Required covering letters prepared and sent to the court with remand bundle.",
        "documents": ["Covering letters to court"],
        "templateIds": ["covering_letters"],
        "phase": "remand",
    },
    {
        "step": 13,
        "id": "post_remand_activities",
        "stage": "Post-Remand Activities",
        "activity": "Entrustment letter, trap ratification, preliminary report to accused's department.",
        "documents": ["Entrustment letter", "trap ratification", "preliminary report"],
        "templateIds": ["entrustment_letter", "trap_ratification_letter", "preliminary_report"],
        "phase": "remand",
    },
    {
        "step": 14,
        "id": "radio_message_initial",
        "stage": "Radio Message — Initial",
        "activity": "Initial radio/AP SWAN message sent to all offices on the same day as remand.",
        "documents": ["Radio message (initial)"],
        "templateIds": ["radio_message"],
        "phase": "remand",
    },
    {
        "step": 15,
        "id": "radio_message_followup",
        "stage": "Radio Message — Follow-Up",
        "activity": "Follow-up radio message sent 48 hours after arrest recommending suspension.",
        "documents": ["Radio message (48-hour follow-up)"],
        "templateIds": ["radio_message_followup"],
        "phase": "remand",
    },
    {
        "step": 16,
        "id": "suspension_orders",
        "stage": "Suspension Orders",
        "activity": "Accused's department issues suspension orders and communicates back to ACB.",
        "documents": ["Suspension order proceedings"],
        "templateIds": ["suspension_order"],
        "phase": "investigation",
    },
    {
        "step": 17,
        "id": "plan_of_action",
        "stage": "Plan of Action",
        "activity": "IO prepares Plan of Action outlining oral/documentary evidence collection and submits to HO.",
        "documents": ["Plan of action"],
        "templateIds": ["plan_of_action"],
        "phase": "investigation",
    },
    {
        "step": 18,
        "id": "court_statements",
        "stage": "Court Statements",
        "activity": "Statements of relevant persons recorded before court under Section 164 CrPC.",
        "documents": ["Sec. 164 court statements"],
        "templateIds": ["court_statement_164"],
        "phase": "investigation",
    },
    {
        "step": 19,
        "id": "reimbursement",
        "stage": "Reimbursement of Money",
        "activity": "Reimbursement proceedings for trap money processed for complainant/treasury.",
        "documents": ["Reimbursement proceedings"],
        "templateIds": ["reimbursement_proceedings"],
        "phase": "investigation",
    },
    {
        "step": 20,
        "id": "first_bail_petition",
        "stage": "First Bail Petition",
        "activity": "Accused files first bail petition before the court.",
        "documents": ["Bail petition"],
        "templateIds": ["bail_petition"],
        "phase": "court",
    },
    {
        "step": 21,
        "id": "bail_counter",
        "stage": "Bail Counter",
        "activity": "ACB files counter-affidavit against the first bail petition.",
        "documents": ["Bail counter"],
        "templateIds": ["bail_counter"],
        "phase": "court",
    },
    {
        "step": 22,
        "id": "release_on_bail",
        "stage": "Release on Bail",
        "activity": "Accused may be released subject to court-imposed conditions.",
        "documents": ["Bail order", "release conditions"],
        "templateIds": ["hearing_diary"],
        "phase": "court",
    },
    {
        "step": 23,
        "id": "form_66",
        "stage": "Form 66 Submission",
        "activity": "Seized amounts, currency notes and particulars submitted to court via Form 66 with CGR Number.",
        "documents": ["Form 66", "CGR number"],
        "templateIds": ["form_66"],
        "phase": "court",
    },
    {
        "step": 24,
        "id": "forensic_examination",
        "stage": "Forensic Examination",
        "activity": "All collected evidence sent to FSL for authenticity verification and analysis.",
        "documents": ["FSL report", "forensic analysis"],
        "templateIds": ["fsl_forensic_report", "evidence_register"],
        "phase": "evidence",
    },
    {
        "step": 25,
        "id": "final_prosecution",
        "stage": "Final Prosecution Documents",
        "activity": "DFR, charge sheet, memo of evidence, documentary evidence index and sanction orders prepared for PP review.",
        "documents": ["DFR", "charge sheet", "memo of evidence", "documentary evidence", "SSO"],
        "templateIds": [
            "dfr_part_1", "dfr_part_2", "draft_charge_sheet",
            "memo_of_evidence", "documentary_evidence_index", "sanction_order_sso",
        ],
        "phase": "prosecution",
    },
]

# ── AI-assisted draft generation workflow (Figure 2) ────────────────────────

AI_DRAFT_WORKFLOW: list[dict[str, Any]] = [
    {
        "step": 1,
        "id": "input_collection",
        "stage": "Input Collection",
        "activity": "Upload complaint, further complaint, verification report, MR-1, MR-2, FIR, witness statements, DFR samples, media, CCTV, FSL reports and seized-document index.",
    },
    {
        "step": 2,
        "id": "ai_extraction",
        "stage": "AI Extraction",
        "activity": "OCR, speech-to-text, translation and NLP extract names, roles, dates, locations, bribe amounts, legal sections, evidence references and key events.",
    },
    {
        "step": 3,
        "id": "structured_case_file",
        "stage": "Structured Case File",
        "activity": "Machine-readable case file organizing complainant, AO, witnesses, allegations, official favour, demand, acceptance, recovery and all evidence.",
    },
    {
        "step": 4,
        "id": "timeline_builder",
        "stage": "Timeline Builder",
        "activity": "Auto-generate chronological timeline from complaint through trap, FIR, arrest, remand, FSL and court statements.",
    },
    {
        "step": 5,
        "id": "evidence_mapping",
        "stage": "Evidence Mapping",
        "activity": "Map every allegation to oral, documentary, material and digital evidence with source details, hashes and seizure references.",
    },
    {
        "step": 6,
        "id": "template_selection",
        "stage": "Template Selection",
        "activity": "Select appropriate document template based on case stage (FIR, plan of action, remand report, DFR, charge sheet, memo of evidence).",
    },
    {
        "step": 7,
        "id": "draft_generation",
        "stage": "Draft Generation",
        "activity": "Generate draft in approved official format populated with structured facts and evidence references.",
    },
    {
        "step": 8,
        "id": "investigator_review",
        "stage": "Investigator Review",
        "activity": "DSP/IO human-in-the-loop review, correction, approval and lock with audit trail.",
    },
    {
        "step": 9,
        "id": "final_export",
        "stage": "Final Export",
        "activity": "Generate final Word/PDF with evidence index and version history for court/government submission.",
    },
]

# Map flow step → primary workflow phase index for status derivation
from app.services.workflow import PHASE_ORDER, phase_index


def _step_status(current_phase: str, step_phase: str) -> str:
    ci = phase_index(current_phase)
    si = phase_index(step_phase)
    if si < ci:
        return "completed"
    if si == ci:
        return "in_progress"
    return "pending"


def build_processing_flow(current_phase: str, *, phase_filter: str | None = None) -> list[dict[str, Any]]:
    """Return all 25 steps with derived status for the case's current phase."""
    result = []
    for s in CASE_PROCESSING_STEPS:
        if phase_filter and s["phase"] != phase_filter:
            continue
        result.append({
            "step": s["step"],
            "id": s["id"],
            "stage": s["stage"],
            "activity": s["activity"],
            "documents": s["documents"],
            "templateIds": s.get("templateIds", []),
            "phase": s["phase"],
            "optional": s.get("optional", False),
            "status": _step_status(current_phase, s["phase"]),
        })
    return result


def build_ai_workflow() -> list[dict[str, Any]]:
    return [{**s} for s in AI_DRAFT_WORKFLOW]


def steps_for_phase(phase: str) -> list[dict[str, Any]]:
    return [s for s in CASE_PROCESSING_STEPS if s["phase"] == phase]


def template_ids_for_phase(phase: str) -> list[str]:
    ids: list[str] = []
    for s in CASE_PROCESSING_STEPS:
        if s["phase"] == phase:
            for tid in s.get("templateIds", []):
                if tid not in ids:
                    ids.append(tid)
    return ids
