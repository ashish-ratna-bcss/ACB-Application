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


import json
from datetime import datetime

class HoDecisionMemoDraftRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    decision: str
    actor_role: str = "ho"

class HoDecisionSubmitRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    decision: str
    actor_role: str = "ho"

class RegisterFirRequest(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    fir_number: str
    actor_role: str = "io"

@router.post("/cases/{case_id}/ho-decision-memo", summary="Draft Head Office Decision Memo")
def draft_ho_decision_memo(case_id: str, payload: HoDecisionMemoDraftRequest):
    if payload.actor_role != "ho":
        raise HTTPException(status_code=403, detail="Forbidden: Action restricted to Head Office (role: ho).")
        
    db = SessionLocal()
    try:
        case = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
            
        decision = payload.decision.lower()
        if decision not in ("approved", "rejected"):
            raise HTTPException(status_code=400, detail="Invalid decision. Must be 'approved' or 'rejected'.")
            
        # Get verification report text from phase_data if available
        pd = json.loads(case.phase_data) if case.phase_data else {}
        verification_report = pd.get("verificationReports", {}).get("verification_report", {})
        verbatim_text = verification_report.get("body", "")
        
        # Call Ollama
        system_prompt = """You are the Head Office (Joint Director / Director General) of the Anti-Corruption Bureau, Telangana.
You write official Decision Memorandums regarding proposed trap operations under the Prevention of Corruption Act, 1988.

Based on the decision (approved or rejected), write exactly 3 numbered paragraphs forming the narrative of the Decision Memo.
You MUST naturally weave in the following phrases from the Bag of Words (BoW) depending on the decision:
- If approved, use: "perused the file", "verification report", "prima facie established", "corroborative evidence", "fit case for trap", "competent authority", "oral permission granted", "instructed to register FIR".
- If rejected, use: "perused the file", "verification report", "lack of sufficient evidence", "trap proposal rejected", "direct departmental action".

The paragraphs should follow this structure:
Paragraph 1: State that the Head Office has perused the file and the verification report regarding the Accused Officer (AO).
Paragraph 2: State the findings from the verification report, highlighting whether demand of illegal gratification is prima facie established with corroborative evidence, or if there is a lack of sufficient evidence.
Paragraph 3: State the final decision (either that it is a fit case for trap, competent authority grants oral permission, and DSP is instructed to register FIR, OR that the trap proposal is rejected and the matter is reverted for direct departmental action).

Format the output strictly as a JSON object with a single key "narrative_paragraphs" mapping to an array of 3 string elements (the paragraphs). Do not output markdown, preambles, or any text other than the JSON."""

        user_prompt = f"""DECISION: {decision.upper()}
ACCUSED OFFICER (AO): {case.accused_name or 'the Accused Officer'}
DESIGNATION: {case.accused_designation or 'not specified'}
DEPARTMENT: {case.accused_department or 'not specified'}
COMPLAINANT: {case.complaint_id or 'the Complainant'}
LOCATION: {case.location or 'not specified'}
BRIBE AMOUNT: Rs. {case.amount_involved or 0}

VERIFICATION REPORT SUMMARY:
{verbatim_text[:4000]}

Generate the narrative paragraphs for the Decision Memo in the requested JSON format."""

        paragraphs = []
        try:
            import requests
            from app.config import OLLAMA_URL, OLLAMA_DRAFT_MODEL, OLLAMA_TIMEOUT
            response = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_DRAFT_MODEL,
                    "system": system_prompt,
                    "prompt": user_prompt,
                    "stream": False,
                    "options": {"temperature": 0.2},
                },
                timeout=OLLAMA_TIMEOUT,
            )
            if response.status_code == 200:
                raw_res = response.json().get("response", "").strip()
                import re
                clean_json = re.sub(r"^```[a-z]*\n?|```$", "", raw_res, flags=re.MULTILINE).strip()
                try:
                    res_data = json.loads(clean_json)
                    paragraphs = res_data.get("narrative_paragraphs", [])
                except Exception:
                    matches = re.findall(r"^\d+\.\s+(.+?)(?=\n\d+\.|\Z)", clean_json, re.DOTALL | re.MULTILINE)
                    paragraphs = [m.strip() for m in matches if len(m.strip()) > 20]
        except Exception:
            pass
            
        if not paragraphs:
            # Fallback
            if decision == "approved":
                paragraphs = [
                    f"The Head Office has perused the file and the verification report submitted by the Inspector, ACB regarding the allegations of demand of illegal gratification by the Accused Officer, {case.accused_name or 'the Accused Officer'}, {case.accused_designation or 'Suspect'}, {case.accused_department or 'Department'}.",
                    f"Upon careful evaluation of the record, the verification findings and the corroborative evidence from the verbatim transcripts of recorded interactions, it is prima facie established that the Accused Officer has demanded illegal gratification of Rs. {case.amount_involved or 0} from the complainant to render official favour.",
                    f"The Head Office deems this a fit case for trap. The competent authority hereby grants oral permission to execute the trap and the Deputy Superintendent of Police is instructed to register the FIR and proceed with the trap operation immediately."
                ]
            else:
                paragraphs = [
                    f"The Head Office has perused the file and the verification report submitted by the Inspector, ACB regarding the allegations of demand of illegal gratification by the Accused Officer, {case.accused_name or 'the Accused Officer'}, {case.accused_designation or 'Suspect'}, {case.accused_department or 'Department'}.",
                    f"Upon careful evaluation of the record, there is a lack of sufficient evidence to establish the demand of illegal gratification or verify the antecedents of the Accused Officer, making a trap operation unviable at this stage.",
                    f"In view of the findings, the trap proposal is rejected by the competent authority. The case is hereby closed and reverted for direct departmental action against the suspect officer."
                ]
                
        current_date_str = datetime.utcnow().strftime("%d.%m.%Y")
        memo_number = f"ACB-HO-{datetime.utcnow().year}-MEMO-{case.id[:6].upper()}"
        
        subject = f"ESTABLISHMENT OF TRAP AGAINST {case.accused_name.upper() if case.accused_name else 'ACCUSED OFFICER'} - PERMISSION ACCORDED - REG." if decision == "approved" else f"PROPOSAL FOR TRAP AGAINST {case.accused_name.upper() if case.accused_name else 'ACCUSED OFFICER'} - REJECTION - REG."
        reference = "Verification Report submitted by Inspector, ACB."
        
        memo = {
            "id": "ho_decision_memo",
            "title": "Head Office Decision Memo",
            "documentType": "ho_memo",
            "caseTrackingId": case.tracking_id or case.id,
            "date": current_date_str,
            "memoNumber": memo_number,
            "subject": subject,
            "reference": reference,
            "narrativeParagraphs": paragraphs,
            "body": "\n\n".join(paragraphs),
            "decision": decision,
            "signatoryName": "Sri C. V. Anand, IPS",
            "signatoryDesignation": "Director General"
        }
        
        pd["hoDecisionMemo"] = memo
        update_phase_data(db, case, pd)
        db.commit()
        db.refresh(case)
        return {"caseId": case.id, "report": memo, "generatedAt": datetime.utcnow().isoformat()}
    finally:
        db.close()

@router.post("/cases/{case_id}/ho-decision-memo/submit", summary="Submit Head Office Decision")
def submit_ho_decision(case_id: str, payload: HoDecisionSubmitRequest):
    if payload.actor_role != "ho":
        raise HTTPException(status_code=403, detail="Forbidden: Action restricted to Head Office (role: ho).")
        
    db = SessionLocal()
    try:
        case = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
            
        decision = payload.decision.lower()
        if decision not in ("approved", "rejected"):
            raise HTTPException(status_code=400, detail="Invalid decision. Must be 'approved' or 'rejected'.")
            
        if decision == "approved":
            transition_case(db, case, substatus="approved", actor_role="ho", notes="HO approved the trap proposal.")
            permission_time = datetime.utcnow().isoformat()
            from app.services.case_workflow import _audit
            _audit(db, case.id, "oral_permission_granted", user_name="Director General", details=f"Oral permission granted at {permission_time}")
            
            pd = json.loads(case.phase_data) if case.phase_data else {}
            pd["oral_permission_time"] = permission_time
            pd["dsp_notified"] = True
            pd["dsp_instructed_inspector"] = False
            update_phase_data(db, case, pd)
            
            try:
                update_checkpoint(db, case.id, "approval", "ho_approval_received", True)
            except Exception:
                pass
        else:
            transition_case(db, case, substatus="rejected", actor_role="ho", notes="HO rejected the trap proposal.")
            case.status = "closed"
            
        db.commit()
        db.refresh(case)
        return get_workflow(db, case)
    finally:
        db.close()

@router.post("/cases/{case_id}/dsp-instruct", summary="DSP instructs Inspector to register FIR")
def dsp_instruct_inspector(case_id: str, payload: dict):
    actor_role = payload.get("actor_role", "dsp")
    if actor_role != "dsp":
        raise HTTPException(status_code=403, detail="Forbidden: Action restricted to DSP.")
        
    db = SessionLocal()
    try:
        case = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
            
        pd = json.loads(case.phase_data) if case.phase_data else {}
        if not pd.get("dsp_notified"):
            raise HTTPException(status_code=400, detail="Cannot instruct inspector before HO approval is received.")
            
        pd["dsp_instructed_inspector"] = True
        update_phase_data(db, case, pd)
        
        from app.services.case_workflow import _audit
        _audit(db, case.id, "dsp_instructed_inspector", user_name="DSP Ramesh Kumar", details="DSP instructed Inspector to register FIR.")
        
        db.commit()
        db.refresh(case)
        return get_workflow(db, case)
    finally:
        db.close()

@router.post("/cases/{case_id}/register-fir", summary="Inspector registers FIR")
def register_fir(case_id: str, payload: RegisterFirRequest):
    if payload.actor_role != "io":
        raise HTTPException(status_code=403, detail="Forbidden: Action restricted to Inspector / Trap Officer.")
        
    db = SessionLocal()
    try:
        case = db.query(Case).filter((Case.id == case_id) | (Case.tracking_id == case_id)).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")
            
        pd = json.loads(case.phase_data) if case.phase_data else {}
        if not pd.get("dsp_instructed_inspector"):
            raise HTTPException(status_code=400, detail="Cannot register FIR before DSP instruction is received.")
            
        case.fir_number = payload.fir_number
        transition_case(db, case, substatus="fir_registered", actor_role="io", notes=f"FIR registered under No. {payload.fir_number}")
        
        try:
            update_checkpoint(db, case.id, "approval", "fir_registered", True)
        except Exception:
            pass
            
        db.commit()
        db.refresh(case)
        return get_workflow(db, case)
    finally:
        db.close()
