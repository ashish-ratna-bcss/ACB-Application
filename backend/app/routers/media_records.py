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


@router.get("/case/{case_id}/check", summary="Check if case has media records")
def check_media_records_exist(case_id: str):
    db = SessionLocal()
    try:
        count = db.query(MediaRecord).filter(MediaRecord.case_id == case_id).count()
        return {"hasMediaRecords": count > 0, "recordCount": count}
    finally:
        db.close()


def _fmt_ts(seconds):
    try:
        s = int(float(seconds))
    except (TypeError, ValueError):
        return "00:00"
    return f"{s // 60:02d}:{s % 60:02d}"


# ── Ollama system prompts (verification-phase report drafting) ────────────────

VERBATIM_CONTEXT_PROMPT = """You are an Investigating Officer in the Anti-Corruption Bureau (ACB).
You are given details of a SINGLE evidence recording. Write a brief contextual paragraph (2-3 sentences) to introduce this recording's transcript in an official Verbatim Report.

CRITICAL INSTRUCTIONS:
- MUST include these exact phrases: "audio and video evidence", "digital voice recorder (DVR)", "converted into text", "exact words uttered", "voluntary demand".
- State that the recording was made during verification of the complaint against the Accused Officer.
- Add brief, objective bracketed notes for any physical actions implied (e.g. [sound of papers rustling]).
- Do NOT reproduce any dialogue — the dialogue table is rendered separately.

Return only the contextual paragraph text. No markdown, no preamble."""

VERIFICATION_SYSTEM_PROMPT = """You are an Investigating Officer (Inspector of Police) in the Anti-Corruption Bureau (ACB).

WARNING: Output ONLY plain English sentences. NEVER use JSON. NEVER use curly braces {{ }}. NEVER use square brackets [ ]. NEVER use colons for key-value pairs.

Write EXACTLY 4 numbered paragraphs forming the body of a Verification Report:

Paragraph 1 — Receipt of the complaint: state that a draft complaint was received, describe the allegation briefly.
Paragraph 2 — Discreet enquiry: state that discreet enquiries were caused into the genuineness of the complaint and antecedents of the Accused Officer.
Paragraph 3 — Findings: state that the A.O. was found to be awfully corrupt and enjoying bad reputation, corroborate with the verbatim transcript evidence.
Paragraph 4 — Recommendation: recommend to the DSP to register the case and take necessary action regarding the official favour sought.

MANDATORY phrases to weave in naturally: "caused discreet enquiries", "genuineness of the complaint", "verified the antecedents", "awfully corrupt and enjoying bad reputation", "official favour".
Use "the Accused Officer" or "A.O." for the suspect. Use "the Complainant" for the victim.

YOUR ENTIRE RESPONSE must look exactly like this (fill in real content):
1. The Inspector of Police, ACB received a draft complaint from the Complainant...
2. On receipt of the complaint, the Inspector caused discreet enquiries...
3. The antecedents of the Accused Officer were verified and it was found that he is awfully corrupt...
4. In view of the above findings, it is respectfully submitted to the DSP...

Begin your response with "1." and nothing else before it."""


def _raw_transcript(record, segments) -> str:
    """Strict speaker-labeled transcript built from diarized segments (source for AI)."""
    if segments:
        lines = []
        for seg in segments:
            spk = seg.get("speaker") or "SPEAKER"
            ts = f"[{_fmt_ts(seg.get('start'))} - {_fmt_ts(seg.get('end'))}]"
            text = (seg.get("text") or "").strip()
            lines.append(f"{ts} {spk}: {text}")
        return "\n".join(lines)
    return (record.text or "").strip() or "No transcript text available."


CONSOLIDATED_GIST_SYSTEM_PROMPT = """You are an elite Investigating Officer in the Anti-Corruption Bureau (ACB).
You are given the verbatim transcripts of MULTIPLE separate evidence recordings from the same case.

Your task: write a single 'Consolidated Conclusion'.
- First decide whether the recordings are genuinely interlinked — i.e. they concern the same Complainant, the same Accused Officer, and the same continuing demand/acceptance of illegal gratification.
- IF they are properly interlinked: write one consolidated conclusion that captures the COMPLETE GIST across all recordings — the sequence of the demand, any escalation, and how the recordings together corroborate the demand for illegal gratification.
- IF they are NOT interlinked (different parties or unrelated matters): clearly state that the recordings are independent and DO NOT fabricate any connection between them.

Do not invent dialogue or facts. Refer to the suspect as "the Accused Officer" or "A.O." and the victim as "the Complainant".
Return only the consolidated conclusion text. No markdown, no preamble."""


def _ollama_generate(system: str, prompt: str) -> str:
    import requests
    from app.config import OLLAMA_URL, OLLAMA_DRAFT_MODEL, OLLAMA_TIMEOUT

    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": OLLAMA_DRAFT_MODEL,
            "system": system,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2},
        },
        timeout=OLLAMA_TIMEOUT,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Ollama error: {response.text}")
    return response.json().get("response", "").strip()


def _today() -> str:
    return datetime.utcnow().strftime("%d.%m.%Y")


OFFICE_HEADER = "GOVERNMENT OF TELANGANA\nANTI-CORRUPTION BUREAU"


def _build_dialogue_lines(segments) -> list[dict]:
    """Convert raw diarized segments into {timestamp, speaker, text} rows.
    These are the exact words — no AI involvement."""
    lines = []
    for seg in segments:
        spk = (seg.get("speaker") or "SPEAKER").upper()
        ts = f"{_fmt_ts(seg.get('start'))} - {_fmt_ts(seg.get('end'))}"
        text = (seg.get("text") or "").strip()
        if text:
            lines.append({"timestamp": ts, "speaker": spk, "text": text})
    return lines


def _context_block_for_recording(rec, dialogue_lines, speakers) -> str:
    """Ask AI for a short contextual intro paragraph for one recording.
    Does NOT reproduce dialogue; that comes from actual segments."""
    prompt = (
        f"Recording file: {rec.file_name or 'evidence recording'}\n"
        f"Language: {rec.language_name or rec.language or 'not specified'}\n"
        f"Speakers identified: {', '.join(sorted(s for s in speakers if s)) or 'not identified'}\n"
        f"Number of dialogue exchanges: {len(dialogue_lines)}\n"
        f"Diarization applied: {'Yes' if rec.diarization else 'No'}\n\n"
        f"Write the contextual introductory paragraph for this recording's verbatim section."
    )
    return _ollama_generate(VERBATIM_CONTEXT_PROMPT, prompt)


def _build_verbatim_report(case, records) -> dict:
    """Build one Verbatim Report covering all attached recordings.

    Structure:
    - Per recording: file-name headed section → context block (AI) + dialogue table (from segments)
    - If multiple recordings: Consolidated Conclusion (AI, only if genuinely interlinked)
    """
    recording_sections: list[dict] = []
    all_speakers: set = set()
    languages: set = set()
    diarized_any = False

    for idx, rec in enumerate(records, 1):
        segments = json.loads(rec.segments) if rec.segments else []
        rec_speakers = {s.get("speaker") for s in segments if s.get("speaker")}
        all_speakers.update(rec_speakers)
        if rec.diarization:
            diarized_any = True
        if rec.language_name or rec.language:
            languages.add(rec.language_name or rec.language)

        dialogue_lines = _build_dialogue_lines(segments)
        # Fallback if no diarized segments: treat full text as one block
        if not dialogue_lines and rec.text:
            dialogue_lines = [{"timestamp": "—", "speaker": "SPEAKER", "text": rec.text.strip()}]

        context_body = _context_block_for_recording(rec, dialogue_lines, rec_speakers)

        recording_sections.append({
            "index": idx,
            "fileName": rec.file_name or f"Recording {idx}",
            "recordingDevice": "Digital Voice Recorder (DVR) / Spy Camera",
            "language": rec.language_name or rec.language or "Not specified",
            "speakers": sorted(s for s in rec_speakers if s),
            "contextBody": context_body,
            "dialogueLines": dialogue_lines,
        })

    # Consolidated conclusion — only when >1 recording; AI decides interlinkage.
    consolidated_conclusion = None
    if len(recording_sections) > 1:
        section_summaries = "\n\n".join(
            f"RECORDING {s['index']} — {s['fileName']}:\n{s['contextBody']}"
            for s in recording_sections
        )
        consolidated_conclusion = _ollama_generate(
            CONSOLIDATED_GIST_SYSTEM_PROMPT,
            f"The case concerns Accused Officer '{case.accused_name or 'A.O.'}'.\n\n"
            f"Per-recording contextual summaries:\n\n{section_summaries[:8000]}\n\n"
            f"Write the Consolidated Conclusion as instructed.",
        )

    # Plain-text body for backward-compat (used as source for verification report).
    text_parts = []
    for s in recording_sections:
        text_parts.append(f"SOURCE FILE: {s['fileName']}\n{s['contextBody']}")
        for dl in s["dialogueLines"]:
            text_parts.append(f"[{dl['timestamp']}] {dl['speaker']}: {dl['text']}")
    if consolidated_conclusion:
        text_parts.append(f"\nCONSOLIDATED CONCLUSION:\n{consolidated_conclusion}")
    body_text = "\n".join(text_parts)

    file_names = [s["fileName"] for s in recording_sections]

    return {
        "id": "verbatim_report",
        "title": "Verbatim Transcript Report",
        "documentType": "verbatim",
        "caseTrackingId": getattr(case, "tracking_id", None) or case.id,
        "date": _today(),
        "inspectorName": "Inspector of Police",
        "districtUnit": "ACB",
        "recordingsCount": len(recording_sections),
        "recordingSections": recording_sections,
        "consolidatedConclusion": consolidated_conclusion,
        # kept for verification report source + gating
        "body": body_text,
        "mediaRecordIds": [r.id for r in records],
        "sourceMediaFiles": file_names,
        "generatedAt": datetime.utcnow().isoformat(),
    }


def _flatten_json_strings(obj, acc: list, min_len: int = 40) -> None:
    """Recursively pull all meaningful string values out of a parsed JSON object."""
    if isinstance(obj, str):
        s = obj.strip()
        if len(s) >= min_len:
            acc.append(s)
    elif isinstance(obj, list):
        for item in obj:
            _flatten_json_strings(item, acc, min_len)
    elif isinstance(obj, dict):
        for v in obj.values():
            _flatten_json_strings(v, acc, min_len)


def _extract_paragraphs(raw: str) -> list[str]:
    """Robustly extract 4 narrative paragraphs from model output.

    Handles three cases:
    1. Well-formed numbered plain text  →  regex parse
    2. Model wrapped everything in JSON  →  flatten string values, then re-parse
    3. Anything else                     →  double-newline split
    """
    import re

    text = raw.strip()

    # --- Case 1: numbered plain-text paragraphs (ideal) ---
    matches = re.findall(r"^\d+\.\s+(.+?)(?=\n\d+\.|\Z)", text, re.DOTALL | re.MULTILINE)
    paras = [m.strip() for m in matches if len(m.strip()) > 20]
    if paras:
        return paras

    # --- Case 2: model output is JSON (common failure mode) ---
    # Strip markdown code fences if present
    text_clean = re.sub(r"^```[a-z]*\n?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(text_clean)
        strings: list[str] = []
        _flatten_json_strings(parsed, strings)
        # Re-run numbered-paragraph extraction on the concatenated strings
        joined = "\n\n".join(strings)
        paras = [s.strip() for s in strings if len(s.strip()) > 40]
        if paras:
            return paras
    except (json.JSONDecodeError, ValueError):
        pass

    # --- Case 3: any other format — split on double-newlines ---
    paras = [p.strip() for p in re.split(r"\n{2,}", text) if len(p.strip()) > 40]
    return paras if paras else [text.strip()]


def _build_verification_report(case, complaint, verbatim_body) -> dict:
    complainant = (complaint.complainant_name if complaint else None) or "the Complainant"
    complaint_date = (
        complaint.created_at.strftime("%d.%m.%Y") if (complaint and complaint.created_at) else _today()
    )
    complaint_summary = case.complaint_summary or (complaint.summary if complaint else "") or "not specified"
    districtUnit = "Hyderabad"  # TODO: derive from case.location if unit-aware

    prompt = (
        f"COMPLAINT DETAILS:\n"
        f"- Complainant: {complainant}\n"
        f"- Accused Officer (A.O.): {case.accused_name or 'the Accused Officer'}\n"
        f"- Designation: {case.accused_designation or 'not specified'}\n"
        f"- Department: {case.accused_department or 'not specified'}\n"
        f"- Place / Location: {case.location or 'not specified'}\n"
        f"- Amount of bribe demanded: Rs. {case.amount_involved or 0}\n"
        f"- Complaint date: {complaint_date}\n"
        f"- Complaint summary: {complaint_summary}\n\n"
        f"VERBATIM REPORT (additional source — evidence from recorded interaction):\n"
        f"{(verbatim_body or '')[:4000]}\n\n"
        f"Using BOTH the complaint details and the verbatim report above as sources, "
        f"draft the Verification Report. Return JSON only as instructed."
    )
    raw = _ollama_generate(VERIFICATION_SYSTEM_PROMPT, prompt)
    paragraphs = _extract_paragraphs(raw)

    body_text = "\n\n".join(paragraphs)

    return {
        "id": "verification_report",
        "title": "Verification Report",
        "documentType": "verification",
        "caseTrackingId": getattr(case, "tracking_id", None) or case.id,
        "date": _today(),
        "districtUnit": districtUnit,
        "accusedName": case.accused_name or "—",
        "accusedDesignation": case.accused_designation or "—",
        "complainantName": complainant,
        "complaintDate": complaint_date,
        "inspectorName": "Inspector of Police",
        "narrativeParagraphs": paragraphs,
        "body": body_text,
        "generatedAt": datetime.utcnow().isoformat(),
    }


@router.post("/{case_id}/draft-verbatim", summary="Step 1 — Draft Verbatim Report from all attached transcripts")
def draft_verbatim_step(case_id: str):
    """Step 1 of 2. Draft and persist the Verbatim Report only."""
    import requests
    from app.models import Case
    from app.services.case_workflow import ensure_checkpoints, update_checkpoint, update_phase_data

    db = SessionLocal()
    try:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        records = db.query(MediaRecord).filter(MediaRecord.case_id == case_id).all()
        if not records:
            raise HTTPException(
                status_code=400,
                detail="Attach a Speech Intelligence transcription before drafting the Verbatim Report.",
            )

        verbatim = _build_verbatim_report(case, records)

        # Persist verbatim; preserve any existing verification_report.
        pd = json.loads(case.phase_data) if case.phase_data else {}
        existing = pd.get("verificationReports", {})
        existing["verbatim_report"] = verbatim
        update_phase_data(db, case, {"verificationReports": existing})

        ensure_checkpoints(db, case_id, "verification")
        for key in ("verbatim_prepared", "av_evidence_attached"):
            try:
                update_checkpoint(db, case_id, "verification", key, True)
            except Exception:
                pass

        db.commit()
        return {"caseId": case_id, "report": verbatim, "generatedAt": datetime.utcnow().isoformat()}
    except requests.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Ollama service unavailable: {str(e)}")
    finally:
        db.close()


@router.post("/{case_id}/draft-verification", summary="Step 2 — Draft Verification Report using verbatim + complaint")
def draft_verification_step(case_id: str):
    """Step 2 of 2. Reads verbatim from phase_data; drafts and persists Verification Report."""
    import requests
    from app.models import Case, Complaint
    from app.services.case_workflow import ensure_checkpoints, update_checkpoint, update_phase_data

    db = SessionLocal()
    try:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        pd = json.loads(case.phase_data) if case.phase_data else {}
        verbatim = pd.get("verificationReports", {}).get("verbatim_report")
        if not verbatim:
            raise HTTPException(
                status_code=400,
                detail="Draft the Verbatim Report first (Step 1) before generating the Verification Report.",
            )

        complaint = (
            db.query(Complaint)
            .filter(Complaint.case_id == case_id)
            .order_by(Complaint.created_at)
            .first()
        )

        verification = _build_verification_report(case, complaint, verbatim.get("body", ""))

        existing = pd.get("verificationReports", {})
        existing["verification_report"] = verification
        update_phase_data(db, case, {"verificationReports": existing})

        ensure_checkpoints(db, case_id, "verification")
        try:
            update_checkpoint(db, case_id, "verification", "verification_report", True)
        except Exception:
            pass

        db.commit()
        return {"caseId": case_id, "report": verification, "generatedAt": datetime.utcnow().isoformat()}
    except requests.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Ollama service unavailable: {str(e)}")
    finally:
        db.close()


@router.post("/{case_id}/draft-report", summary="Draft both reports in one call (kept for backward compat)")
def draft_verification_report(case_id: str):
    """Calls draft-verbatim then draft-verification sequentially."""
    draft_verbatim_step(case_id)
    return draft_verification_step(case_id)


@router.patch("/{case_id}/save-report", summary="Save manual edits to a drafted report")
def save_report_edits(case_id: str, payload: dict):
    """Updates narrativeParagraphs (verification) or contextBlocks+conclusion (verbatim) from edited text."""
    import re as _re
    from app.models import Case
    from app.services.case_workflow import update_phase_data

    db = SessionLocal()
    try:
        case = db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

        report_id = payload.get("report_id", "")
        content = payload.get("content", "")

        pd = json.loads(case.phase_data) if case.phase_data else {}

        if report_id == "ho_decision_memo":
            memo = pd.get("hoDecisionMemo", {})
            if not memo:
                raise HTTPException(status_code=404, detail="Head Office Decision Memo not found in phase data")
            paras = [p.strip() for p in content.split("\n\n") if p.strip()]
            memo["narrativeParagraphs"] = paras
            memo["body"] = content
            pd["hoDecisionMemo"] = memo
            update_phase_data(db, case, pd)
            db.commit()
            return {"ok": True, "report": memo}

        reports = pd.get("verificationReports", {})
        if report_id not in reports:
            raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found in phase data")

        if report_id == "verification_report":
            paras = [p.strip() for p in content.split("\n\n") if p.strip()]
            reports[report_id]["narrativeParagraphs"] = paras

        elif report_id == "verbatim_report":
            # Parse "## Recording: <name>" and "## Consolidated Conclusion" sections
            parts = _re.split(r'^## (.+)$', content, flags=_re.MULTILINE)
            # parts = ['preamble', 'Recording: f1.mp3', 'body', 'Consolidated Conclusion', 'body', ...]
            sections = list(reports[report_id].get("recordingSections", []))
            conclusion = reports[report_id].get("consolidatedConclusion")
            it = iter(parts[1:])  # skip preamble
            sec_idx = 0
            for header, body in zip(it, it):
                body = body.strip()
                if header.startswith("Recording:"):
                    if sec_idx < len(sections):
                        sections[sec_idx] = {**sections[sec_idx], "contextBlock": body}
                        sec_idx += 1
                elif header.strip() == "Consolidated Conclusion":
                    conclusion = body
            reports[report_id]["recordingSections"] = sections
            if conclusion is not None:
                reports[report_id]["consolidatedConclusion"] = conclusion

        update_phase_data(db, case, {"verificationReports": reports})
        db.commit()
        return {"ok": True, "report": reports[report_id]}
    finally:
        db.close()
