"""ACB phase report templates — standardized sub-document structures per workflow phase."""

from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import Case, ReportTemplate

# ── Phase panel metadata (UI titles/descriptions) ───────────────────────────

PHASE_PANEL_META: dict[str, dict[str, str]] = {
    "complaint": {
        "title": "Complaint & Statement",
        "desc": "Initial complaint (may be draft without evidence) submitted to DSP. Further complaints in EN/TE may follow after verification (Steps 1, 4).",
    },
    "verification": {
        "title": "Verification",
        "desc": "DSP-initiated verification by Inspector. Verification Report with A/V evidence; verbatim transcript from recordings (Steps 2–3).",
    },
    "approval": {
        "title": "Approval & FIR Registration",
        "desc": "Trap permission note to HO, approval received, FIR registered same day as trap (Steps 5–7).",
    },
    "trap": {
        "title": "Trap Operations",
        "desc": "MR-1 pre-trap, trap execution with signal, MR-2 post-trap, optional MR-3, scene sketch and seizure memo (Steps 8–10).",
    },
    "remand": {
        "title": "Remand & Administrative Communications",
        "desc": "Remand case diary, covering letters, entrustment, ratification, preliminary report, initial and 48-hr radio messages (Steps 11–15).",
    },
    "investigation": {
        "title": "Investigation & Departmental Proceedings",
        "desc": "Suspension orders, plan of action, Sec. 164 court statements, trap money reimbursement (Steps 16–19).",
    },
    "evidence": {
        "title": "Evidence & Forensic Examination",
        "desc": "FSL forensic examination, chain of custody, evidence register (Step 24).",
    },
    "court": {
        "title": "Court & Bail Proceedings",
        "desc": "Bail petition, bail counter, release on bail, Form 66 with CGR submission (Steps 20–23).",
    },
    "prosecution": {
        "title": "Final Prosecution Documents",
        "desc": "DFR Part-I/II, charge sheet, memo of evidence, documentary index, model sanction order for PP review (Step 25).",
    },
}


def _section(key: str, title: str, description: str = "", fields: list[dict] | None = None) -> dict:
    return {"key": key, "title": title, "description": description, "fields": fields or []}


def _field(key: str, label: str, field_type: str = "text", required: bool = False, placeholder: str = "") -> dict:
    return {"key": key, "label": label, "type": field_type, "required": required, "placeholder": placeholder}


# ── Canonical template definitions (synthesized from ACB case file standards) ─

TEMPLATE_DEFINITIONS: list[dict[str, Any]] = [
    {
        "id": "complaint_statement",
        "phase": "complaint",
        "title": "Initial Complaint / Statement of Complainant",
        "short_title": "Complaint Statement",
        "description": "Formal statement of the complainant addressed to ACB, with narrative and endorsement.",
        "document_type": "complaint",
        "sort_order": 1,
        "structure": {
            "sections": [
                _section("header", "Header", "Addressed to the Inspector or Deputy Superintendent of Police (DSP), ACB.", [
                    _field("addressee", "Addressee (Inspector / DSP, ACB)", required=True),
                    _field("office_location", "ACB Office / Jurisdiction"),
                ]),
                _section("complainant_particulars", "Complainant Particulars", fields=[
                    _field("full_name", "Full Name", required=True),
                    _field("father_name", "Father's Name"),
                    _field("age", "Age", "number"),
                    _field("occupation", "Occupation"),
                    _field("caste", "Caste (if recorded)"),
                    _field("residential_address", "Residential Address", "textarea", required=True),
                ]),
                _section("narrative_body", "Narrative Body", "Detailed account of grievance — background of pending official work, accused officer particulars, date/time/amount of bribe demand.", [
                    _field("background_work", "Background of Official Work Pending", "textarea", required=True),
                    _field("accused_officer_name", "Accused Officer (AO) Name", required=True),
                    _field("accused_designation", "AO Designation"),
                    _field("demand_date", "Date of Demand", "date"),
                    _field("demand_time", "Time of Demand"),
                    _field("demand_amount", "Amount Demanded", "currency"),
                    _field("narrative", "Full Narrative (regional language original + English translation)", "textarea", required=True),
                ]),
                _section("endorsement", "Endorsement", "Complainant signature/thumb impression and recording officer certification.", [
                    _field("complainant_signature", "Complainant Signature / Thumb Impression"),
                    _field("recording_officer", "Recording Police Officer"),
                    _field("certification", "Certification (read over and admitted correct)", "textarea"),
                ]),
            ],
        },
    },
    {
        "id": "verification_report",
        "phase": "verification",
        "title": "Verification Report",
        "short_title": "Verification Report",
        "description": "Independent verification of demand before trap permission is sought.",
        "document_type": "verification_report",
        "sort_order": 1,
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("verification_officer", "Verification Officer", required=True),
                    _field("verification_date", "Date of Verification", "date", required=True),
                    _field("dsp_range", "DSP Range / Unit"),
                ]),
                _section("findings", "Verification Findings", fields=[
                    _field("demand_confirmed", "Demand Independently Confirmed", "boolean", required=True),
                    _field("confirmed_amount", "Confirmed Amount", "currency"),
                    _field("observation", "Verification Observation", "textarea", required=True),
                    _field("supporting_evidence", "Supporting Evidence Summary", "textarea"),
                ]),
                _section("recommendation", "Recommendation", fields=[
                    _field("recommended_action", "Recommended Action"),
                    _field("approving_authority", "Approving Authority (DSP)"),
                    _field("dsp_remarks", "DSP Remarks", "textarea"),
                ]),
            ],
        },
    },
    {
        "id": "fir",
        "phase": "approval",
        "title": "First Information Report (FIR)",
        "short_title": "FIR",
        "description": "Standardized police form (A.P.P.M. Orders 470, 660) registering the trap case.",
        "document_type": "fir",
        "sort_order": 2,
        "structure": {
            "sections": [
                _section("jurisdiction", "Jurisdiction & Codes", fields=[
                    _field("district", "District", required=True),
                    _field("police_station", "Police Station"),
                    _field("year", "Year", "number"),
                    _field("fir_number", "FIR No.", required=True),
                    _field("fir_date", "Date of Registration", "date", required=True),
                    _field("pc_act_sections", "Sections Invoked (P.C. Act 1988)", placeholder="Typically Section 7"),
                ]),
                _section("offence_details", "Offence Details", fields=[
                    _field("occurrence_date", "Date of Occurrence", "date"),
                    _field("occurrence_time", "Time of Occurrence"),
                    _field("distance_from_ps", "Distance/Direction from Police Station"),
                    _field("offence_narrative", "Brief Facts of Offence", "textarea", required=True),
                ]),
                _section("suspect_details", "Suspect Details (Accused Officer)", fields=[
                    _field("physical_features", "Physical Features", "textarea"),
                    _field("identification_marks", "Identification Marks"),
                    _field("accused_name", "Name", required=True),
                    _field("accused_designation", "Designation"),
                    _field("accused_department", "Department"),
                ]),
                _section("action_taken", "Action Taken", fields=[
                    _field("investigating_officer", "Investigating Officer (Rank & Name)", required=True),
                    _field("registration_remarks", "Registration Remarks", "textarea"),
                ]),
            ],
        },
    },
    {
        "id": "mediators_report_1",
        "phase": "trap",
        "title": "Mediators Report - I (Pre-Trap Proceedings)",
        "short_title": "Mediators Report-I",
        "description": "Pre-trap proceedings at ACB office — currency documentation, chemical test demo, and complainant instructions.",
        "document_type": "mediators_report_1",
        "sort_order": 1,
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("location", "Location (ACB Office)", required=True),
                    _field("proceedings_date", "Date", "date", required=True),
                    _field("start_time", "Start Time"),
                    _field("end_time", "End Time"),
                ]),
                _section("officials", "Mediators & Officials", fields=[
                    _field("mediators", "Independent Mediators (Name, Age, Designation)", "textarea", required=True),
                    _field("acb_officials", "ACB Officials Present", "textarea"),
                    _field("investigating_officer", "Investigating Officer"),
                ]),
                _section("currency_documentation", "Currency Documentation", "Exact denomination and serial numbers of every currency note.", [
                    _field("total_amount", "Total Trap Amount", "currency", required=True),
                    _field("currency_notes", "Denomination & Serial Numbers (table)", "table", required=True),
                ]),
                _section("chemical_test", "Chemical Test Demonstration", fields=[
                    _field("phenolphthalein_application", "Phenolphthalein Powder Application", "textarea"),
                    _field("demonstration_details", "Sodium Carbonate Solution Demonstration", "textarea"),
                ]),
                _section("instructions", "Instructions to Complainant", fields=[
                    _field("payment_instruction", "Pay bribe only on demand", "textarea"),
                    _field("conduct_rules", "No handshake / specific conduct rules"),
                    _field("prearranged_signal", "Pre-arranged Signal (e.g. wipe face with handkerchief)", required=True),
                ]),
                _section("signatures", "Signatures", fields=[
                    _field("mediator_signatures", "Mediator Signatures & Attestation"),
                    _field("io_signature", "Investigating Officer Signature"),
                ]),
            ],
        },
    },
    {
        "id": "mediators_report_2",
        "phase": "trap",
        "title": "Mediators Report - II (Post-Trap Proceedings)",
        "short_title": "Mediators Report-II",
        "description": "Post-trap proceedings at scene — trap execution, chemical test, recovery, seizure and arrest.",
        "document_type": "mediators_report_2",
        "sort_order": 2,
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("drafting_location", "Location Drafted (AO residence/office/scene)", required=True),
                    _field("commencement_time", "Time Commenced"),
                ]),
                _section("sequence", "Sequence of Events", fields=[
                    _field("trap_party_position", "Trap Party Waiting Outside"),
                    _field("complainant_entry", "Complainant Entry Details"),
                    _field("signal_execution", "Pre-arranged Signal Execution", required=True),
                ]),
                _section("trap_and_test", "The Trap & Chemical Test", fields=[
                    _field("officials_rush_in", "ACB Officials Rush In & Secure AO"),
                    _field("hand_dip_test", "AO Hands Dipped in Fresh Sodium Carbonate Solution"),
                    _field("solution_result", "Solution Turning Pink (Positive Test)", required=True),
                ]),
                _section("recovery", "Recovery", fields=[
                    _field("search_details", "Search of AO's Person (e.g. right hip pocket)"),
                    _field("notes_recovered", "Recovery of Tainted Notes"),
                    _field("serial_cross_reference", "Serial Number Cross-Reference with Report-I", required=True),
                ]),
                _section("seizure_arrest", "Seizure & Arrest", fields=[
                    _field("clothing_seized", "AO Clothing Seized (chemical test)"),
                    _field("official_files_seized", "Related Official Files Seized"),
                    _field("spot_explanation", "AO Spontaneous Explanation"),
                    _field("arrest_details", "Formal Arrest Details"),
                ]),
            ],
        },
    },
    {
        "id": "radio_message",
        "phase": "remand",
        "title": "Radio / AP SWAN / Automex Message",
        "short_title": "Radio Message (Initial)",
        "description": "Initial telegraphic message sent on remand day to DG ACB, Vigilance Commissioner and departmental heads.",
        "document_type": "radio_message",
        "sort_order": 7,
        "structure": {
            "sections": [
                _section("routing", "Header & Routing", fields=[
                    _field("from_authority", "From (DSP/Inspector)", required=True),
                    _field("to_dg_acb", "To: Director General ACB"),
                    _field("to_vigilance_commissioner", "To: Vigilance Commissioner"),
                    _field("to_departmental_heads", "To: Accused's Departmental Heads"),
                ]),
                _section("summary", "Summary Block", "Condensed one-paragraph summary in capital letters.", [
                    _field("fir_summary", "FIR Summary"),
                    _field("trap_summary", "Trap Execution Summary"),
                    _field("chemical_test_result", "Chemical Test Result"),
                    _field("recovery_summary", "Recovery of Bribe"),
                    _field("arrest_summary", "Arrest Summary"),
                    _field("full_summary_caps", "Full Summary (ALL CAPS paragraph)", "textarea", required=True),
                ]),
                _section("call_to_action", "Call to Action", fields=[
                    _field("suspension_request", "Formal Request to Place Accused Under Suspension", "textarea", required=True),
                ]),
            ],
        },
    },
    {
        "id": "preliminary_report",
        "phase": "remand",
        "title": "Preliminary Report",
        "short_title": "Preliminary Report",
        "description": "Formal letter from DG ACB to Principal Secretary requesting suspension and caveat filing.",
        "document_type": "preliminary_report",
        "sort_order": 6,
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("from", "From: Director General, ACB", required=True),
                    _field("to", "To: Principal Secretary, Concerned Department", required=True),
                    _field("through", "Through: Vigilance Commissioner"),
                ]),
                _section("enclosures", "Enclosures", fields=[
                    _field("fir_copy", "Copy of FIR"),
                    _field("mediators_report_1", "Mediators Report-I"),
                    _field("mediators_report_2", "Mediators Report-II"),
                ]),
                _section("content", "Content", fields=[
                    _field("trap_facts", "Facts of Trap Reiterated", "textarea", required=True),
                    _field("judicial_remand", "Judicial Remand of AO"),
                    _field("suspension_request", "Request for Immediate Suspension", "textarea", required=True),
                    _field("caveat_request", "Request for Filing Caveats in Courts", "textarea"),
                ]),
            ],
        },
    },
    {
        "id": "suspension_order",
        "phase": "investigation",
        "title": "Suspension Order",
        "short_title": "Suspension Order",
        "description": "Proceedings of competent authority placing the trapped officer under suspension.",
        "document_type": "suspension_order",
        "sort_order": 1,
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("competent_authority", "Competent Authority (e.g. District Collector / Regional Director)", required=True),
                    _field("proceedings_title", "Title: PROCEEDINGS OF THE [Authority]"),
                ]),
                _section("preamble", "Preamble", "Whereas it has come to the notice...", [
                    _field("trap_facts", "Officer Trapped by ACB and Arrested", "textarea", required=True),
                ]),
                _section("order_clause", "Order Clause", fields=[
                    _field("rule_reference", "Sub-Rule (1) of Rule (8) Reference"),
                    _field("suspension_effective", "Suspension with Immediate Effect Until Conclusion of Proceedings", required=True),
                ]),
                _section("conditions", "Conditions", fields=[
                    _field("headquarters_restriction", "Cannot Leave Headquarters Without Permission"),
                    _field("subsistence_allowance", "Subsistence Allowance Rules"),
                ]),
            ],
        },
    },
    {
        "id": "plan_of_action",
        "phase": "investigation",
        "title": "Plan of Action",
        "short_title": "Plan of Action",
        "description": "Tabular plan covering case details, evidence collection checklist and general actions timeline.",
        "document_type": "plan_of_action",
        "sort_order": 2,
        "structure": {
            "sections": [
                _section("case_details", "Case Details", fields=[
                    _field("case_file_number", "Case File Number", required=True),
                    _field("accused_name", "Name of Accused", required=True),
                    _field("accused_designation", "Designation of Accused"),
                    _field("retirement_date", "Date of Retirement", "date"),
                    _field("allegation_summary", "Brief Summary of Allegation", "textarea", required=True),
                ]),
                _section("oral_evidence", "Oral Evidence Checklist", fields=[
                    _field("witnesses_examined", "Witnesses Already Examined", "table"),
                    _field("witnesses_yet_to_examine", "Witnesses Yet to be Examined", "table"),
                ]),
                _section("documentary_evidence", "Documentary Evidence Checklist", fields=[
                    _field("documents_seized", "Documents Seized", "table"),
                    _field("documents_to_collect", "Documents Yet to be Collected", "table"),
                ]),
                _section("general_actions", "General Actions", fields=[
                    _field("final_report_timeline", "Timeline for Submitting Final Report"),
                    _field("administrative_steps", "Other Administrative Steps", "textarea"),
                ]),
            ],
        },
    },
    {
        "id": "dfr_part_1",
        "phase": "prosecution",
        "title": "Final Report Part-I (Draft Final Report / DFR)",
        "short_title": "DFR Part-I",
        "description": "Comprehensive investigative summary in standardized Roman numeral sections.",
        "document_type": "dfr_part_1",
        "sort_order": 1,
        "structure": {
            "sections": [
                _section("I", "I. Introduction / Allegation", fields=[_field("introduction", "Brief Facts of the Case", "textarea", required=True)]),
                _section("II", "II. Service Particulars", fields=[_field("service_table", "AO Career History, Salary, Retirement Date", "table", required=True)]),
                _section("III", "III. Facts Leading to Registration", fields=[_field("pre_trap_history", "Pre-Trap History", "textarea")]),
                _section("IV", "IV. Pre-Trap Actions", fields=[_field("pre_trap_summary", "Summary of Mediators Report-I", "textarea")]),
                _section("V", "V. Sequence of Trap Happenings", fields=[_field("trap_summary", "Summary of Mediators Report-II", "textarea")]),
                _section("VI", "VI. Oral Evidence", fields=[_field("oral_evidence", "Bulleted Summaries of Witness Statements", "textarea", required=True)]),
                _section("VII", "VII. Documentary Evidence", fields=[_field("documentary_evidence", "What Each Document Proves", "textarea", required=True)]),
                _section("VIII", "VIII. Explanation of the AO", fields=[_field("ao_explanation", "Defense Offered by Accused", "textarea")]),
                _section("IX", "IX. Rebuttal", fields=[_field("io_rebuttal", "IO Arguments Disproving Defense", "textarea")]),
                _section("X", "X. Findings and Recommendations", fields=[_field("findings_table", "Table Substantiating Allegations & Prosecution Recommendation", "table", required=True)]),
            ],
        },
    },
    {
        "id": "dfr_part_2",
        "phase": "prosecution",
        "title": "Final Report Part-II (Legal Opinion)",
        "short_title": "DFR Part-II (Legal Opinion)",
        "description": "Legal officer's analysis of sufficiency of evidence for conviction.",
        "document_type": "dfr_part_2",
        "sort_order": 2,
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("crime_number", "Crime No.", required=True),
                    _field("ao_details", "AO Details"),
                    _field("disciplinary_rules", "Applicable Disciplinary Rules"),
                    _field("legal_officer", "Legal Officer Name", required=True),
                ]),
                _section("legal_analysis", "Legal Analysis", fields=[
                    _field("factual_matrix", "Summary of Factual Matrix", "textarea", required=True),
                    _field("evidence_sufficiency", "Analysis of Oral & Documentary Evidence Sufficiency", "textarea", required=True),
                ]),
                _section("conclusion", "Conclusion", fields=[
                    _field("prosecution_recommendation", "Recommendation (e.g. liable to be prosecuted)", "textarea", required=True),
                ]),
            ],
        },
    },
    {
        "id": "draft_charge_sheet",
        "phase": "prosecution",
        "title": "Draft Charge Sheet",
        "short_title": "Draft Charge Sheet",
        "description": "Legal pleading addressed to Principal Special Judge for SPE & ACB Cases.",
        "document_type": "charge_sheet",
        "sort_order": 3,
        "structure": {
            "sections": [
                _section("court_header", "Court Header", fields=[
                    _field("court", "Principal Special Judge for SPE & ACB Cases", required=True),
                ]),
                _section("parties", "Parties", fields=[
                    _field("state", "Between: The State...", required=True),
                    _field("accused", "AND [Accused Officer]", required=True),
                ]),
                _section("charges", "Body — Formal Charges", fields=[
                    _field("pc_act_sections", "Sections under Prevention of Corruption Act 1988", required=True),
                    _field("chronological_narrative", "Chronological Narrative of the Crime", "textarea", required=True),
                ]),
                _section("memo_of_evidence", "Memo of Evidence", fields=[
                    _field("witnesses", "Witness List (LW-1, LW-2, ...) with Testimony Summary", "table", required=True),
                ]),
            ],
        },
    },
    {
        "id": "sanction_order_sso",
        "phase": "prosecution",
        "title": "Specimen / Model Sanction Order (SSO)",
        "short_title": "Sanction Order (G.O.)",
        "description": "Government Order accordings sanction for prosecution under Section 19 PC Act 1988.",
        "document_type": "sanction_order",
        "sort_order": 4,
        "structure": {
            "sections": [
                _section("header", "Government Order Format", fields=[
                    _field("go_title", "GOVERNMENT OF ANDHRA PRADESH ABSTRACT", required=True),
                ]),
                _section("preamble", "Preamble", "Whereas... employment status, demand, trap, recovery.", [
                    _field("employment_status", "Employment Status of AO"),
                    _field("demand_facts", "Facts of Demand"),
                    _field("trap_facts", "Facts of Trap"),
                    _field("recovery_facts", "Recovery of Bribe"),
                ]),
                _section("sanction_clause", "Sanction Clause", fields=[
                    _field("section_19_reference", "Section 19 PC Act 1988 — clause (b) sub-section (1)", required=True),
                    _field("sanction_text", "Sanction for Prosecution of Accused Officer", "textarea", required=True),
                ]),
            ],
        },
    },
    {
        "id": "evidence_register",
        "phase": "evidence",
        "title": "Evidence Register",
        "short_title": "Evidence Register",
        "description": "Chain-of-custody register for all seized and logged evidence items.",
        "document_type": "evidence_register",
        "sort_order": 1,
        "structure": {
            "sections": [
                _section("registry", "Evidence Registry", fields=[
                    _field("items", "Evidence Items (type, hash, status, custodian)", "table", required=True),
                    _field("access_audit", "Access Audit Log", "table"),
                ]),
            ],
        },
    },
    {
        "id": "hearing_diary",
        "phase": "court",
        "title": "Hearing Diary",
        "short_title": "Hearing Diary",
        "description": "Court hearing schedule, summons tracking and orders recorded.",
        "document_type": "hearing_diary",
        "sort_order": 1,
        "structure": {
            "sections": [
                _section("court_details", "Court Details", fields=[
                    _field("court", "Court Name", required=True),
                    _field("case_number", "Court Case Number"),
                ]),
                _section("hearings", "Hearings", fields=[
                    _field("hearing_dates", "Hearing Dates & Bench Details", "table"),
                    _field("summons_status", "Witness Summons Status", "table"),
                    _field("orders", "Court Orders Recorded", "textarea"),
                ]),
            ],
        },
    },
]


from app.services.flow_templates import FLOW_TEMPLATE_DEFINITIONS


def all_template_definitions() -> list[dict[str, Any]]:
    """Merge core + flow templates, deduplicated by id."""
    merged = list(TEMPLATE_DEFINITIONS)
    seen = {t["id"] for t in merged}
    for tpl in FLOW_TEMPLATE_DEFINITIONS:
        if tpl["id"] in seen:
            continue
        merged.append({k: v for k, v in tpl.items() if k not in ("flow_steps", "optional")})
    return merged


def seed_report_templates(db: Session) -> int:
    """Upsert all canonical templates. Returns count of templates ensured."""
    count = 0
    for tpl in all_template_definitions():
        existing = db.query(ReportTemplate).filter(ReportTemplate.id == tpl["id"]).first()
        structure_json = json.dumps(tpl["structure"])
        if existing:
            existing.phase = tpl["phase"]
            existing.title = tpl["title"]
            existing.short_title = tpl["short_title"]
            existing.description = tpl["description"]
            existing.document_type = tpl["document_type"]
            existing.sort_order = tpl["sort_order"]
            existing.structure = structure_json
            existing.version = "1.0"
            existing.is_active = 1
        else:
            db.add(ReportTemplate(
                id=tpl["id"],
                phase=tpl["phase"],
                title=tpl["title"],
                short_title=tpl["short_title"],
                description=tpl["description"],
                document_type=tpl["document_type"],
                sort_order=tpl["sort_order"],
                structure=structure_json,
                version="1.0",
                is_active=1,
            ))
        count += 1
    db.commit()
    return count


def template_to_dict(t: ReportTemplate, *, include_structure: bool = True) -> dict[str, Any]:
    structure = json.loads(t.structure) if t.structure else {"sections": []}
    result: dict[str, Any] = {
        "id": t.id,
        "phase": t.phase,
        "title": t.title,
        "shortTitle": t.short_title,
        "description": t.description,
        "documentType": t.document_type,
        "sortOrder": t.sort_order,
        "version": t.version,
        "sectionCount": len(structure.get("sections", [])),
    }
    if include_structure:
        result["structure"] = structure
    return result


def get_templates_for_phase(db: Session, phase: str, *, include_structure: bool = False) -> list[dict[str, Any]]:
    rows = (
        db.query(ReportTemplate)
        .filter(ReportTemplate.phase == phase, ReportTemplate.is_active == 1)
        .order_by(ReportTemplate.sort_order)
        .all()
    )
    return [template_to_dict(r, include_structure=include_structure) for r in rows]


def get_all_templates(db: Session, *, phase: str | None = None, include_structure: bool = False) -> list[dict[str, Any]]:
    q = db.query(ReportTemplate).filter(ReportTemplate.is_active == 1)
    if phase:
        q = q.filter(ReportTemplate.phase == phase)
    rows = q.order_by(ReportTemplate.phase, ReportTemplate.sort_order).all()
    return [template_to_dict(r, include_structure=include_structure) for r in rows]


def get_template_by_id(db: Session, template_id: str) -> dict[str, Any] | None:
    row = db.query(ReportTemplate).filter(ReportTemplate.id == template_id).first()
    return template_to_dict(row) if row else None


def build_phase_panel(db: Session, case: Case, phase: str) -> dict[str, Any]:
    """Build UI panel metadata for a workflow phase, including report templates."""
    from app.services.case_processing_flow import steps_for_phase

    meta = PHASE_PANEL_META.get(phase, {"title": phase.replace("_", " ").title(), "desc": ""})
    templates = get_templates_for_phase(db, phase)
    flow_steps = steps_for_phase(phase)
    documents = [
        {
            "templateId": t["id"],
            "name": t["title"],
            "meta": f"{t['sectionCount']} sections · v{t['version']}",
            "status": "Template",
            "documentType": t["documentType"],
            "flowStep": next(
                (fs["step"] for fs in flow_steps if t["id"] in fs.get("templateIds", [])),
                None,
            ),
        }
        for t in templates
    ]
    return {
        "title": meta["title"],
        "desc": meta["desc"],
        "fields": _case_fields_for_phase(case, phase),
        "documents": documents,
        "reportTemplates": templates,
        "flowSteps": [
            {
                "step": s["step"],
                "id": s["id"],
                "stage": s["stage"],
                "activity": s["activity"],
                "templateIds": s.get("templateIds", []),
                "optional": s.get("optional", False),
            }
            for s in flow_steps
        ],
    }


def _case_fields_for_phase(case: Case, phase: str) -> list[dict[str, str]]:
    """Derive key particulars from the case record for the active phase."""
    amt = f"₹{case.amount_involved:,.0f}" if case.amount_involved else "—"
    common = [
        {"label": "Case Tracking ID", "value": case.tracking_id or case.case_number or "—", "font": "'JetBrains Mono',monospace"},
        {"label": "Accused Officer", "value": case.accused_name or "—", "font": "inherit"},
        {"label": "Department", "value": case.accused_department or "—", "font": "inherit"},
    ]
    by_phase: dict[str, list[dict[str, str]]] = {
        "complaint": [
            {"label": "Complaint Ref", "value": case.complaint_id or "—", "font": "'JetBrains Mono',monospace"},
            {"label": "DSP Assigned", "value": case.dsp_name or "—", "font": "inherit"},
            {"label": "Demand Amount", "value": amt, "font": "'JetBrains Mono',monospace"},
            {"label": "Language", "value": (case.language or "en").upper(), "font": "inherit"},
        ],
        "verification": [
            {"label": "IO", "value": case.officer_name or "—", "font": "inherit"},
            {"label": "Demand Amount", "value": amt, "font": "'JetBrains Mono',monospace"},
            {"label": "Location", "value": case.location or "—", "font": "inherit"},
        ],
        "approval": [
            {"label": "FIR No.", "value": case.fir_number or "Pending", "font": "'JetBrains Mono',monospace"},
            {"label": "Sections", "value": "Sec. 7, P.C. Act 1988", "font": "inherit"},
            {"label": "DSP", "value": case.dsp_name or "—", "font": "inherit"},
        ],
        "trap": [
            {"label": "Trap Amount", "value": amt, "font": "'JetBrains Mono',monospace"},
            {"label": "Location", "value": case.location or "—", "font": "inherit"},
            {"label": "Incident Date", "value": case.incident_date or "—", "font": "'JetBrains Mono',monospace"},
        ],
        "remand": [
            {"label": "IO Assigned", "value": case.officer_name or "—", "font": "inherit"},
            {"label": "FIR No.", "value": case.fir_number or "—", "font": "'JetBrains Mono',monospace"},
        ],
        "investigation": [
            {"label": "IO", "value": case.officer_name or "—", "font": "inherit"},
            {"label": "AO Designation", "value": case.accused_designation or "—", "font": "inherit"},
        ],
        "prosecution": [
            {"label": "Charges u/s", "value": "Sec. 7 r/w 13, P.C. Act", "font": "inherit"},
            {"label": "Sanction Authority", "value": "Govt. of Telangana", "font": "inherit"},
        ],
    }
    return common + by_phase.get(phase, [])
