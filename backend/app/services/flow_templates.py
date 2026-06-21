"""Additional ACB report templates for the full 25-step case processing flow."""

from __future__ import annotations

from typing import Any

from app.services.report_templates import _field, _section

FLOW_TEMPLATE_DEFINITIONS: list[dict[str, Any]] = [
    {
        "id": "further_complaint",
        "phase": "complaint",
        "title": "Further Complaint / Supplementary Statement",
        "short_title": "Further Complaint",
        "description": "Detailed complaint recorded after verification; may be in English or Telugu with translation.",
        "document_type": "further_complaint",
        "sort_order": 2,
        "flow_steps": [4],
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("addressee", "Addressed to DSP / Inspector, ACB", required=True),
                    _field("reference_complaint", "Reference Initial Complaint ID"),
                ]),
                _section("particulars", "Complainant Particulars", fields=[
                    _field("full_name", "Full Name", required=True),
                    _field("language", "Language (EN / TE / Bilingual)", required=True),
                ]),
                _section("narrative", "Detailed Narrative", fields=[
                    _field("allegation_details", "Expanded Allegation Details", "textarea", required=True),
                    _field("translation", "English Translation (if regional language)", "textarea"),
                ]),
                _section("endorsement", "Endorsement", fields=[
                    _field("complainant_signature", "Complainant Signature"),
                    _field("recording_officer", "Recording Officer Certification"),
                ]),
            ],
        },
    },
    {
        "id": "verbatim_transcript",
        "phase": "verification",
        "title": "Verbatim Transcript",
        "short_title": "Verbatim",
        "description": "Text transcript converted from audio/video recordings collected during verification.",
        "document_type": "verbatim",
        "sort_order": 2,
        "flow_steps": [3],
        "structure": {
            "sections": [
                _section("source", "Source Media", fields=[
                    _field("media_ref", "Linked Audio/Video File Reference", required=True),
                    _field("recording_date", "Recording Date", "date"),
                    _field("language", "Original Language"),
                ]),
                _section("transcript", "Verbatim Text", fields=[
                    _field("transcript_te", "Telugu Transcript", "textarea"),
                    _field("transcript_en", "English Transcript", "textarea", required=True),
                    _field("speaker_labels", "Speaker Labels / Diarization", "table"),
                ]),
                _section("validation", "Validation", fields=[
                    _field("validated_by", "Validated By"),
                    _field("validation_date", "Validation Date", "date"),
                ]),
            ],
        },
    },
    {
        "id": "trap_permission_note",
        "phase": "approval",
        "title": "Trap Permission Note",
        "short_title": "Trap Permission",
        "description": "Case note with complaint, verification report and evidence bundle sent to Head Office for trap approval.",
        "document_type": "trap_permission",
        "sort_order": 1,
        "flow_steps": [5],
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("from_dsp", "From: DSP, ACB", required=True),
                    _field("to_ho", "To: Director General / Head Office, ACB", required=True),
                    _field("submission_date", "Date", "date"),
                ]),
                _section("case_summary", "Case Summary", fields=[
                    _field("complainant", "Complainant"),
                    _field("accused_officer", "Accused Officer", required=True),
                    _field("demand_amount", "Demand Amount", "currency"),
                    _field("allegation_brief", "Brief Allegation", "textarea", required=True),
                ]),
                _section("enclosures", "Enclosures", fields=[
                    _field("complaint_copy", "Complaint Copy"),
                    _field("verification_report", "Verification Report"),
                    _field("verbatim", "Verbatim Transcript"),
                    _field("av_evidence", "Audio/Video Evidence Index", "table"),
                ]),
                _section("request", "Approval Request", fields=[
                    _field("trap_request", "Request for Permission to Conduct Trap", "textarea", required=True),
                ]),
            ],
        },
    },
    {
        "id": "trap_ratification_letter",
        "phase": "remand",
        "title": "Trap Ratification Letter",
        "short_title": "Trap Ratification",
        "description": "Official confirmation of oral/telephonic trap permission granted prior to execution.",
        "document_type": "trap_ratification",
        "sort_order": 4,
        "flow_steps": [13],
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("from_authority", "From: Competent Authority / HO", required=True),
                    _field("to_dsp", "To: DSP, ACB Unit"),
                ]),
                _section("ratification", "Ratification", fields=[
                    _field("oral_permission_date", "Date of Oral/Telephonic Permission"),
                    _field("permission_details", "Permission Details Confirmed", "textarea", required=True),
                    _field("ratification_date", "Ratification Date", "date"),
                ]),
            ],
        },
    },
    {
        "id": "entrustment_letter",
        "phase": "remand",
        "title": "Entrustment Letter (Further Investigation)",
        "short_title": "Entrustment Letter",
        "description": "DSP to HO request assigning an Investigating Officer for further investigation after remand.",
        "document_type": "entrustment",
        "sort_order": 5,
        "flow_steps": [13],
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("from_dsp", "From: DSP, ACB", required=True),
                    _field("to_ho", "To: Head Office / Director General, ACB", required=True),
                ]),
                _section("entrustment", "Entrustment Details", fields=[
                    _field("crime_number", "Crime / RC Number", required=True),
                    _field("accused_details", "Accused Officer Particulars"),
                    _field("proposed_io", "Proposed Investigating Officer", required=True),
                    _field("entrustment_scope", "Scope of Further Investigation", "textarea"),
                ]),
            ],
        },
    },
    {
        "id": "mediators_report_3",
        "phase": "trap",
        "title": "Mediators Report - III (Additional Location)",
        "short_title": "Mediators Report-III",
        "description": "Prepared only when bribe acceptance occurs at a location other than the AO's standard office.",
        "document_type": "mediators_report_3",
        "sort_order": 3,
        "flow_steps": [10],
        "optional": True,
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("location", "Alternate Acceptance Location", required=True),
                    _field("date", "Date", "date"),
                    _field("time", "Time"),
                ]),
                _section("circumstances", "Special Circumstances", fields=[
                    _field("reason_alternate_location", "Reason for Alternate Location", "textarea", required=True),
                    _field("proceedings", "Proceedings at Alternate Location", "textarea", required=True),
                ]),
                _section("evidence", "Evidence", fields=[
                    _field("recovery_details", "Recovery Details"),
                    _field("mediator_signatures", "Mediator Signatures"),
                ]),
            ],
        },
    },
    {
        "id": "scene_sketch",
        "phase": "trap",
        "title": "Scene Sketch",
        "short_title": "Scene Sketch",
        "description": "Detailed sketch of trap scene prepared by Mediator/Trap Officer with vantage positions.",
        "document_type": "scene_sketch",
        "sort_order": 4,
        "flow_steps": [9],
        "structure": {
            "sections": [
                _section("scene", "Scene Details", fields=[
                    _field("location", "Scene Location", required=True),
                    _field("sketch_date", "Date", "date"),
                    _field("prepared_by", "Prepared By (Mediator / Trap Officer)"),
                ]),
                _section("layout", "Sketch Layout", fields=[
                    _field("vantage_positions", "Vantage Positions of Trap Party", "textarea"),
                    _field("entry_exit", "Entry/Exit Points"),
                    _field("sketch_attachment", "Sketch Diagram Reference / Attachment"),
                ]),
            ],
        },
    },
    {
        "id": "seizure_memo",
        "phase": "trap",
        "title": "Seizure Memo",
        "short_title": "Seizure Memo",
        "description": "Memo documenting seizure of tainted currency, clothing, official files and related articles.",
        "document_type": "seizure_memo",
        "sort_order": 5,
        "flow_steps": [9],
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("seizure_date", "Date of Seizure", "date", required=True),
                    _field("seizure_time", "Time"),
                    _field("place", "Place of Seizure"),
                ]),
                _section("articles", "Seized Articles", fields=[
                    _field("currency_seized", "Tainted Currency (denomination & serial numbers)", "table", required=True),
                    _field("clothing_seized", "Clothing / Apparel Seized"),
                    _field("official_files", "Official Files / Records Seized", "table"),
                    _field("other_articles", "Other Articles", "table"),
                ]),
                _section("witnesses", "Witnesses", fields=[
                    _field("seizing_officer", "Seizing Officer"),
                    _field("witnesses_present", "Witnesses Present", "table"),
                ]),
            ],
        },
    },
    {
        "id": "remand_case_diary",
        "phase": "remand",
        "title": "Remand Case Diary",
        "short_title": "Remand Case Diary",
        "description": "Consolidated bundle: initial complaint, further complaint(s), FIR, MR-1, MR-2 and supporting evidence.",
        "document_type": "remand_diary",
        "sort_order": 1,
        "flow_steps": [11],
        "structure": {
            "sections": [
                _section("index", "Bundle Index", fields=[
                    _field("initial_complaint", "Initial Complaint"),
                    _field("further_complaints", "Further Complaint(s)", "table"),
                    _field("fir", "FIR", required=True),
                    _field("mr1", "Mediators Report-I"),
                    _field("mr2", "Mediators Report-II"),
                    _field("mr3", "Mediators Report-III (if applicable)"),
                    _field("supporting_evidence", "Supporting Evidence Index", "table"),
                ]),
                _section("remand", "Remand Particulars", fields=[
                    _field("remand_court", "Remand Court", required=True),
                    _field("remand_date", "Remand Date", "date"),
                    _field("custody_details", "Custody Details", "textarea"),
                ]),
            ],
        },
    },
    {
        "id": "covering_letters",
        "phase": "remand",
        "title": "Covering Letters to Court",
        "short_title": "Covering Letters",
        "description": "Required covering letters prepared and sent to the court with remand bundle.",
        "document_type": "covering_letter",
        "sort_order": 2,
        "flow_steps": [12],
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("from_office", "From: ACB Office", required=True),
                    _field("to_court", "To: Remand Court", required=True),
                    _field("letter_date", "Date", "date"),
                ]),
                _section("content", "Letter Content", fields=[
                    _field("subject", "Subject", required=True),
                    _field("enclosures_list", "List of Enclosures", "table", required=True),
                    _field("body", "Letter Body", "textarea", required=True),
                ]),
            ],
        },
    },
    {
        "id": "radio_message_followup",
        "phase": "remand",
        "title": "Radio Message — Follow-Up (48 Hours)",
        "short_title": "Radio Message (Follow-Up)",
        "description": "Follow-up radio message sent 48 hours after arrest recommending suspension to higher authorities.",
        "document_type": "radio_message_followup",
        "sort_order": 3,
        "flow_steps": [15],
        "structure": {
            "sections": [
                _section("routing", "Header & Routing", fields=[
                    _field("from_authority", "From (DSP/Inspector)", required=True),
                    _field("to_department_heads", "To: Accused's Higher Authorities", required=True),
                    _field("arrest_date", "Date of Arrest", "date"),
                    _field("message_date", "Message Date (48 hrs post-arrest)", "date"),
                ]),
                _section("summary", "Summary", fields=[
                    _field("arrest_summary", "Arrest & Remand Summary", "textarea", required=True),
                    _field("suspension_recommendation", "Recommendation for Suspension", "textarea", required=True),
                ]),
            ],
        },
    },
    {
        "id": "internal_note_file",
        "phase": "approval",
        "title": "Internal Note File",
        "short_title": "Note File",
        "description": "Administrative backbone capturing internal movement, vetting, approvals and cross-references for all documents.",
        "document_type": "note_file",
        "sort_order": 3,
        "flow_steps": [5, 6, 7],
        "structure": {
            "sections": [
                _section("movement", "File Movement", fields=[
                    _field("note_entries", "Note Entries (date, from, to, subject)", "table", required=True),
                    _field("vetting_remarks", "Vetting Remarks by Director/DSP", "textarea"),
                ]),
                _section("cross_references", "Cross-References", fields=[
                    _field("linked_documents", "Linked Document References", "table"),
                    _field("approval_chain", "Approval Chain", "table"),
                ]),
            ],
        },
    },
    {
        "id": "court_statement_164",
        "phase": "investigation",
        "title": "Court Statement (Section 164 CrPC)",
        "short_title": "Sec. 164 Statement",
        "description": "Statements of relevant persons recorded before the court under Section 164 CrPC.",
        "document_type": "court_statement_164",
        "sort_order": 3,
        "flow_steps": [18],
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("court", "Court Name", required=True),
                    _field("recording_date", "Date of Recording", "date"),
                    _field("magistrate", "Magistrate / Judge"),
                ]),
                _section("witness", "Witness Particulars", fields=[
                    _field("witness_name", "Witness Name", required=True),
                    _field("witness_role", "Role (Complainant / Mediator / Official Witness)"),
                    _field("statement_text", "Statement Text", "textarea", required=True),
                ]),
            ],
        },
    },
    {
        "id": "reimbursement_proceedings",
        "phase": "investigation",
        "title": "Reimbursement of Trap Money",
        "short_title": "Reimbursement",
        "description": "Proceedings for reimbursement of trap money to the complainant/treasury.",
        "document_type": "reimbursement",
        "sort_order": 4,
        "flow_steps": [19],
        "structure": {
            "sections": [
                _section("particulars", "Particulars", fields=[
                    _field("amount", "Amount to Reimburse", "currency", required=True),
                    _field("currency_details", "Currency Note Details", "table"),
                    _field("complainant", "Complainant / Payee"),
                ]),
                _section("proceedings", "Proceedings", fields=[
                    _field("treasury_ref", "Treasury / CGR Reference"),
                    _field("approval", "Approval Details", "textarea"),
                ]),
            ],
        },
    },
    {
        "id": "bail_petition",
        "phase": "court",
        "title": "First Bail Petition (Accused)",
        "short_title": "Bail Petition",
        "description": "First bail petition filed by the accused before the court.",
        "document_type": "bail_petition",
        "sort_order": 2,
        "flow_steps": [20],
        "structure": {
            "sections": [
                _section("header", "Court Header", fields=[
                    _field("court", "Court Name", required=True),
                    _field("petition_date", "Petition Date", "date"),
                ]),
                _section("petition", "Petition", fields=[
                    _field("accused_details", "Accused Particulars"),
                    _field("grounds", "Grounds for Bail", "textarea", required=True),
                    _field("prayer", "Prayer / Relief Sought", "textarea"),
                ]),
            ],
        },
    },
    {
        "id": "bail_counter",
        "phase": "court",
        "title": "Bail Counter (ACB)",
        "short_title": "Bail Counter",
        "description": "ACB counter-affidavit filed against the accused's first bail petition.",
        "document_type": "bail_counter",
        "sort_order": 3,
        "flow_steps": [21],
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("court", "Court Name", required=True),
                    _field("counter_date", "Counter Date", "date"),
                    _field("io_name", "Investigating Officer"),
                ]),
                _section("counter", "Counter Arguments", fields=[
                    _field("case_strength", "Strength of Prosecution Case", "textarea", required=True),
                    _field("objections", "Objections to Bail", "textarea", required=True),
                ]),
            ],
        },
    },
    {
        "id": "form_66",
        "phase": "court",
        "title": "Form 66 Submission",
        "short_title": "Form 66",
        "description": "Submission of seized amounts, currency notes and particulars to court with CGR Number.",
        "document_type": "form_66",
        "sort_order": 4,
        "flow_steps": [23],
        "structure": {
            "sections": [
                _section("seizure", "Seized Property Particulars", fields=[
                    _field("seized_amount", "Seized Amount", "currency", required=True),
                    _field("currency_notes", "Currency Note Details", "table", required=True),
                    _field("other_property", "Other Seized Property", "table"),
                ]),
                _section("submission", "Court Submission", fields=[
                    _field("cgr_number", "CGR Number", required=True),
                    _field("submission_date", "Submission Date", "date"),
                    _field("court", "Court"),
                ]),
            ],
        },
    },
    {
        "id": "fsl_forensic_report",
        "phase": "evidence",
        "title": "FSL Forensic Examination Report",
        "short_title": "FSL Report",
        "description": "Forensic Science Laboratory report on authenticity and analysis of collected evidence.",
        "document_type": "fsl_report",
        "sort_order": 2,
        "flow_steps": [24],
        "structure": {
            "sections": [
                _section("header", "Header", fields=[
                    _field("fsl_reference", "FSL Reference Number", required=True),
                    _field("lab_name", "Laboratory Name"),
                    _field("report_date", "Report Date", "date"),
                ]),
                _section("exhibits", "Exhibits Examined", fields=[
                    _field("exhibits", "Exhibit List (currency, clothing, samples)", "table", required=True),
                ]),
                _section("findings", "Findings", fields=[
                    _field("chemical_analysis", "Chemical Analysis Results", "textarea"),
                    _field("conclusion", "Forensic Conclusion", "textarea", required=True),
                ]),
            ],
        },
    },
    {
        "id": "memo_of_evidence",
        "phase": "prosecution",
        "title": "Memo of Evidence",
        "short_title": "Memo of Evidence",
        "description": "Witness list (LW-1, LW-2, ...) with precise testimony each will provide to support prosecution.",
        "document_type": "memo_of_evidence",
        "sort_order": 5,
        "flow_steps": [25],
        "structure": {
            "sections": [
                _section("witnesses", "Witness List", fields=[
                    _field("witness_table", "LW No. | Name | Role | Testimony Summary", "table", required=True),
                ]),
                _section("documentary", "Documentary Evidence Index", fields=[
                    _field("documents", "Document | Purpose | Page Reference", "table"),
                ]),
            ],
        },
    },
    {
        "id": "documentary_evidence_index",
        "phase": "prosecution",
        "title": "Documentary Evidence Index",
        "short_title": "Documentary Evidence",
        "description": "Comprehensive index of all documentary evidence for PP review and court submission.",
        "document_type": "documentary_evidence",
        "sort_order": 6,
        "flow_steps": [25],
        "structure": {
            "sections": [
                _section("index", "Evidence Index", fields=[
                    _field("documents", "Sl. No. | Document | Date | Description | Exhibit Mark", "table", required=True),
                ]),
                _section("certification", "Certification", fields=[
                    _field("prepared_by", "Prepared By (IO)"),
                    _field("certification_date", "Date", "date"),
                ]),
            ],
        },
    },
]
