"""
RAG-based Final Report draft generator.

For each of 13 template section groups:
  1. Embed the section's semantic query  (nomic-embed-text)
  2. Search Qdrant for top-3 most relevant sub-docs (filtered by case_id)
  3. Pull full content from SQLite for those sub-docs
  4. One Ollama call fills all sub-sections in the group

Hardcoded verbatim (never AI-generated):
  10.6 — Section 20 PC Act presumption text
  11.3 — TCS Conduct Rules 1964, Rule 3
  11.5 — Section 7 old vs amended comparison
  11.6 — Inevitable and irresistible conclusion template
  11.7 — No notice to AO required text
  11.8 — 10 Supreme Court judgments on simultaneous proceedings
  13.0 — Prosecution sanction request text
  13.4 — Section 19 PC Act 1988 sanction period text

Falls back to mechanical draft_generator if Qdrant/Ollama unreachable.
"""
from __future__ import annotations

import json
import logging
import os

from app.config import (
    OLLAMA_DRAFT_MODEL, OLLAMA_EMBED_MODEL, OLLAMA_TIMEOUT, OLLAMA_URL,
    QDRANT_COLLECTION, QDRANT_URL,
)
from app.services.draft_generator import (
    INEVITABLE_CONCLUSION_TEXT,
    NO_NOTICE_REQUIRED_TEXT,
    PROSECUTION_SANCTION_TEXT,
    SECTION_19_PC_ACT_TEXT,
    SECTION_20_PC_ACT_TEXT,
    SECTION_7_DIFFERENCE_TEXT,
    SUPREME_COURT_CASES_TEXT,
    TCS_CONDUCT_RULES_TEXT,
    TODO,
)
from app.services import report_table_generator

logger = logging.getLogger(__name__)

# ── Draft generation progress (in-memory, keyed by case_id) ──────────────────
_draft_progress: dict[str, dict] = {}

def get_draft_progress(case_id: str) -> dict:
    return _draft_progress.get(case_id, {})

def _set_draft_progress(case_id: str, current: int, total: int, sections: list[str]) -> None:
    _draft_progress[case_id] = {"current": current, "total": total, "sections": sections, "done": False}

def _clear_draft_progress(case_id: str) -> None:
    _draft_progress.pop(case_id, None)

# ── Template: section groups with semantic queries ────────────────────────────
# Each group = one Qdrant search + one Ollama call.
# 'query' is what gets embedded to find relevant sub-docs.
# 'sections' maps section-number → heading shown to AI.

SECTION_GROUPS = [
    {
        "query": "background of case RC number trap case Anti-Corruption Bureau ACB source of complaint oral written suo motu date demand bribe acceptance accused officer name designation department introduction",
        "sections": {
            "1.1": "Background of the case",
            "1.2": "Source of complaint (Written / Oral / Suo Motu)",
            "1.3": "Date(s) of demand and date of acceptance of bribe",
        },
    },
    {
        "query": "accused officer name designation department place of posting job chart duties responsibilities",
        "sections": {
            "2.1": "Name, designation, and department of Accused Officer",
            "2.2": "Place of posting at the time of offence",
            "2.3": "Job chart of Accused Officer",
        },
    },
    {
        "query": "demand illegal gratification bribe acceptance obtaining misuse official position abuse public duty official favour",
        "sections": {
            "3.1": "Demand of illegal gratification",
            "3.2": "Acceptance or obtaining of bribe",
            "3.3": "Misuse of official position or abuse of public duty",
            "3.4": "Official favour rendered to complainant",
        },
    },
    {
        "query": "complaint date contents complainant verification discreet inquiry electronic recording supplementary complaint",
        "sections": {
            "4.1": "Date and contents of complaint",
            "4.2": "Verification of complaint (discreet inquiry / electronic recording, if any)",
            "4.3": "Receipt of further or supplementary complaint, if applicable",
        },
    },
    {
        "query": "FIR first information report registration number date sections invoked Prevention of Corruption Act BNSS",
        "sections": {
            "5.1": "FIR number, date, and sections invoked under relevant laws",
        },
    },
    {
        "query": "pre-trap proceedings complainant shadow witness mediator phenolphthalein powder currency notes serial numbers denomination amount chemical reaction signal instructions place date time grudges financial issues table",
        "sections": {
            "6.1": "Introduction of complainant and shadow/mediator witnesses",
            "6.2": "Preparation of trap money (application of phenolphthalein powder)",
            "6.3": "Noting down serial numbers of currency notes",
            "6.4": "Demonstration of chemical reaction to mediators",
            "6.5": "Instructions given to complainant and shadow witness",
            "6.6": "Fixing place, date, and time for acceptance of bribe",
            "6.7": "Pre-arranged signal",
            "6.8": "Confirmation of no personal grudges or financial issues between complainant and accused",
        },
    },
    {
        "query": "post-trap proceedings vantage position signal apprehension phenolphthalein test chemical test seizure bribe video recording spot explanation official records examination arrest",
        "sections": {
            "7.1":  "Vantage positions taken by trap party",
            "7.2":  "Receipt of pre-arranged signal",
            "7.3":  "Apprehension of Accused Officer",
            "7.4":  "Phenolphthalein test on hands/fingers of AO",
            "7.5":  "Chemical test of contact portion (pocket/other relevant surfaces)",
            "7.6":  "Seizure of tainted bribe amount",
            "7.7":  "Video recording/photography of proceedings",
            "7.8":  "Immediate explanation offered by AO (spot explanation)",
            "7.9":  "Seizure of official records related to complainant's pending work",
            "7.10": "Examination of complainant",
            "7.11": "Examination of official witness regarding status of pending work",
            "7.12": "Examination of independent/official witnesses present at time of acceptance",
            "7.13": "Arrest of accused (if effected)",
        },
    },
    {
        "query": "oral evidence statement complainant shadow witness mediator official witness circumstantial witness",
        "sections": {
            "8.1": "Statement of complainant",
            "8.2": "Statements of shadow witness",
            "8.3": "Statements of mediators",
            "8.4": "Statements of official witnesses",
            "8.5": "Statements of circumstantial witnesses",
        },
    },
    {
        "query": "documentary evidence complaint FIR pre-trap post-trap proceedings digital audio video FSL official records BNSS attendance CDR CAF certificate",
        "sections": {
            "9.1": "Complaint",
            "9.2": "FIR",
            "9.3": "Pre-trap and post-trap proceedings reports",
            "9.4": "Digital evidence (audio/video recordings, transcripts, FSL report)",
            "9.5": "Seized official records relating to official favour",
            "9.6": "Statement recorded under Section 183 BNSS",
            "9.7": "Attendance record of the AO on the date of demand and acceptance",
            "9.8": "CDRs analysis, CAF, S. 63 Certificate",
        },
    },
    {
        "query": "analysis evidence demand verbatim acceptance verbatim public duty performance corroboration documentary digital",
        "sections": {
            "10.1": "Evidence for Demand",
            "10.2": "Verbatim for demand",
            "10.3": "Evidence for Acceptance",
            "10.4": "Verbatim for acceptance",
            "10.5": "Evidence for performance of public duty by AO",
            "10.7": "Corroboration of documentary and digital evidences",
        },
    },
    {
        "query": "findings investigation summary facts established role accused offences committed sections law procedural lapses",
        "sections": {
            "11.1": "Summary of facts established",
            "11.2": "Role of accused and offences committed (relevant sections of Law)",
            "11.4": "Procedural lapses noticed, if any",
        },
    },
    {
        "query": "abstract findings recommendations prosecution name designation sections attracted evidence",
        "sections": {
            "12.1": "Tabular presentation including name, designation, sections attracted, evidence, and recommendation for prosecution",
        },
    },
    {
        "query": "prosecution sanction competent authority grounds enclosures documents SO DAC",
        "sections": {
            "13.1": "Competent authority for sanction",
            "13.2": "Grounds for grant of sanction",
            "13.3": "Enclosures of relevant documents i.e., SO, DACs",
        },
    },
    {
        "query": "call data records CDR cell tower location timestamp mobile phone outgoing incoming call duration IMEI table date time analysis communication",
        "sections": {
            "14.1": "Call Data Records analysis with timestamps, tower locations, and call details",
        },
    },
    {
        "query": "Supreme Court decision judgment case law precedent legal principles Prevention of Corruption Act sections interpretation Raghubir Singh Madhukar Bhaskarrao Joshi",
        "sections": {
            "15.1": "Legal Precedents and Supreme Court interpretations",
        },
    },
]

# Full template structure — used to build the final output dict
TEMPLATE_STRUCTURE = [
    {"number": "1",  "heading": "Introduction",                              "subs": ["1.1","1.2","1.3"]},
    {"number": "2",  "heading": "Service Particulars of the Accused Officer (AO)", "subs": ["2.1","2.2","2.3"]},
    {"number": "3",  "heading": "Allegation in Brief",                       "subs": ["3.1","3.2","3.3","3.4"]},
    {"number": "4",  "heading": "Complaint",                                 "subs": ["4.1","4.2","4.3"]},
    {"number": "5",  "heading": "Registration of FIR",                       "subs": ["5.1"]},
    {"number": "6",  "heading": "Pre-Trap Proceedings",                      "subs": ["6.1","6.2","6.3","6.4","6.5","6.6","6.7","6.8"]},
    {"number": "7",  "heading": "Post-Trap Proceedings",                     "subs": ["7.1","7.2","7.3","7.4","7.5","7.6","7.7","7.8","7.9","7.10","7.11","7.12","7.13"]},
    {"number": "8",  "heading": "Oral Evidence",                             "subs": ["8.1","8.2","8.3","8.4","8.5"]},
    {"number": "9",  "heading": "Documentary Evidence",                      "subs": ["9.1","9.2","9.3","9.4","9.5","9.6","9.7","9.8"]},
    {"number": "10", "heading": "Analysis of Evidence",                      "subs": ["10.1","10.2","10.3","10.4","10.5","10.6","10.7"]},
    {"number": "11", "heading": "Findings of Investigation",                 "subs": ["11.1","11.2","11.3","11.4","11.5","11.6","11.7","11.8"]},
    {"number": "12", "heading": "Abstract of Findings and Recommendations",  "subs": ["12.1"]},
    {"number": "13", "heading": "Request for Prosecution Sanction Order",    "subs": ["13.0","13.1","13.2","13.3","13.4"]},
    {"number": "14", "heading": "Call Data Records",                            "subs": ["14.1"]},
    {"number": "15", "heading": "Legal Precedents",                             "subs": ["15.1"]},
]

# Sub-section headings lookup
_SUB_HEADINGS: dict[str, str] = {}
for _g in SECTION_GROUPS:
    _SUB_HEADINGS.update(_g["sections"])
_SUB_HEADINGS["10.6"] = "Presumption under Section 20 of PC Act"
_SUB_HEADINGS["11.3"] = "Violation of Conduct Rules"
_SUB_HEADINGS["11.5"] = "Difference between old and amended Section 7 of PC Act 1988"
_SUB_HEADINGS["11.6"] = "Inevitable and irresistible conclusion"
_SUB_HEADINGS["11.7"] = "Notice to Accused Officer not required under statute"
_SUB_HEADINGS["11.8"] = "Simultaneous departmental proceedings — Supreme Court judgments"
_SUB_HEADINGS["13.0"] = ""  # no heading — just the legal text block
_SUB_HEADINGS["13.4"] = "Section 19 of the Prevention of Corruption Act, 1988"
_SUB_HEADINGS["14.1"] = "Call Data Records"
_SUB_HEADINGS["15.1"] = "Decisions of the Supreme Court"

# ── System prompt ─────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are an expert legal drafter for the Anti-Corruption Bureau, Telangana. You write official Final Reports in trap cases for submission to Government authorities for obtaining Prosecution Sanction under the Prevention of Corruption Act, 1988.

You will be given source content extracted from case documents and a set of report sections to fill.

Write the best possible official report using the source content. Use formal government language, third person, past tense. Never fabricate facts — only use what is in the source content. If information for a section is not in the source, write [TO BE FILLED].

Return valid JSON only. Keys must exactly match the section numbers given. No markdown, no preamble, no explanation outside the JSON."""


# ── Content retrieval helpers ─────────────────────────────────────────────────

def _post_process_section(section_num: str, content: str, extracted_data: dict | None = None) -> str:
    """
    Post-process AI-generated content to add formatted tables for sections that need them.

    Section 6.3 (currency notes) and 14.1 (CDR) can include HTML tables if structured data provided.
    Other sections returned as-is.
    """
    if section_num == "6.3" and extracted_data and extracted_data.get("currency_notes"):
        table_html = report_table_generator.generate_currency_table(extracted_data["currency_notes"])
        return f"{content}\n\n{table_html}"

    if section_num == "14.1" and extracted_data and extracted_data.get("cdr_records"):
        table_html = report_table_generator.generate_cdr_table(extracted_data["cdr_records"])
        return f"{content}\n\n{table_html}"

    if section_num == "8.1" and extracted_data and extracted_data.get("witnesses"):
        witness_html = report_table_generator.generate_witness_list(extracted_data["witnesses"])
        return f"{content}\n\n{witness_html}"

    if section_num == "12.1" and extracted_data and extracted_data.get("findings"):
        table_html = report_table_generator.generate_abstract_table(extracted_data["findings"])
        return f"{content}\n\n{table_html}"

    return content


def _fetch_content_from_db(db, document_id: int, start_page: int, sub_document_id: int | None = None) -> str | None:
    """Pull full sub-document content from SQLite.
    Uses sub_document_id (new reindex payload) or falls back to document_id + start_page.
    """
    from app.models import SubDocument, SubDocumentContent

    if sub_document_id:
        sd = db.query(SubDocument).filter(SubDocument.id == sub_document_id).first()
    else:
        sd = (
            db.query(SubDocument)
            .filter(
                SubDocument.document_id == document_id,
                SubDocument.start_page == start_page,
            )
            .first()
        )
    if not sd:
        return None

    content = (
        db.query(SubDocumentContent)
        .filter(SubDocumentContent.sub_document_id == sd.id)
        .first()
    )
    if not content:
        return None

    parts = [
        f"[Document: {sd.title} | Pages {sd.start_page}–{sd.end_page}]",
    ]

    # Include main content only (skip metadata noise)
    if content.main_content:
        main = content.main_content[:8000]
        parts.append(f"Content:\n{main}")

    # Include only if very brief and relevant (skip verbose summaries)
    if content.summary and len(content.summary) < 300:
        parts.append(f"Summary: {content.summary}")

    return "\n".join(parts)


def _load_extracted_evidence(db, document_id: int) -> list[tuple[str, dict]]:
    """Load all extracted evidence objects for a document.

    Returns: list of (subdoc_title, evidence_dict) tuples
    """
    from app.models import SubDocument, SubDocumentContent
    from app.services.evidence_extractor import deserialize_evidence

    subdocs = db.query(SubDocument).filter(SubDocument.document_id == document_id).all()
    results = []

    for sd in subdocs:
        content = db.query(SubDocumentContent).filter(
            SubDocumentContent.sub_document_id == sd.id
        ).first()

        if content and content.evidence_objects:
            evidence = deserialize_evidence(content.evidence_objects)
            results.append((sd.title or "Unknown", evidence))

    return results


def _populate_table_sections(db, document_id: int, filled: dict[str, str]) -> None:
    """Populate table sections (6.3, 8.1, 9.8, 12.1, 14.1) using extracted evidence.

    Directly populates `filled` dict with table HTML instead of AI-generated text.
    """
    evidence_list = _load_extracted_evidence(db, document_id)

    # Aggregate evidence from all subdocs
    all_witnesses = []
    all_currency = []
    all_cdr = []
    all_findings = []

    for title, evidence in evidence_list:
        all_witnesses.extend(evidence.get("witnesses", []))
        all_currency.extend(evidence.get("currency_notes", []))
        all_cdr.extend(evidence.get("cdr_records", []))
        all_findings.extend(evidence.get("findings", []))

    # Deduplicate by key fields
    seen_witness_names = set()
    dedup_witnesses = []
    for w in all_witnesses:
        name = w.get("name", "").lower()
        if name and name not in seen_witness_names:
            dedup_witnesses.append(w)
            seen_witness_names.add(name)

    seen_currency = set()
    dedup_currency = []
    for c in all_currency:
        key = (c.get("serial_number"), c.get("denomination"))
        if key not in seen_currency:
            dedup_currency.append(c)
            seen_currency.add(key)

    seen_cdr = set()
    dedup_cdr = []
    for r in all_cdr:
        key = (r.get("date_time"), r.get("ao_phone"), r.get("complaint_phone"))
        if key not in seen_cdr:
            dedup_cdr.append(r)
            seen_cdr.add(key)

    # Findings are usually unique, keep as-is

    # Generate and populate tables
    if dedup_currency:
        filled["6.3"] = report_table_generator.generate_currency_table(dedup_currency)

    if dedup_witnesses:
        filled["8.1"] = report_table_generator.generate_witness_list(dedup_witnesses)

    if dedup_cdr:
        filled["14.1"] = report_table_generator.generate_cdr_table(dedup_cdr)

    if all_findings:
        filled["12.1"] = report_table_generator.generate_abstract_table(all_findings)


# ── Main entry point ──────────────────────────────────────────────────────────

def generate_draft_rag(case_id: str, db, document_id: int | None = None) -> dict:
    """
    Generate draft using RAG (Qdrant + Ollama) with evidence-first table population.

    Args:
        case_id: Case identifier
        db: Database session
        document_id: Optional document ID. If not provided, uses most recent document for case.

    Raises on failure so caller can fall back to mechanical generator.
    """
    import ollama
    from qdrant_client import QdrantClient
    from qdrant_client.models import FieldCondition, Filter, MatchValue
    from app.models import Document

    # Find document_id if not provided
    if document_id is None:
        doc = db.query(Document).filter(Document.case_id == case_id).order_by(Document.created_at.desc()).first()
        if doc:
            document_id = doc.id

    ollama_url  = os.getenv("OLLAMA_URL",           OLLAMA_URL)
    embed_model = os.getenv("OLLAMA_EMBED_MODEL",  OLLAMA_EMBED_MODEL)
    chat_model  = os.getenv("OLLAMA_DRAFT_MODEL",  OLLAMA_DRAFT_MODEL)
    qdrant_url  = os.getenv("QDRANT_URL",          QDRANT_URL)

    timeout_str   = os.getenv("OLLAMA_TIMEOUT", str(OLLAMA_TIMEOUT) if OLLAMA_TIMEOUT else "None")
    timeout       = int(timeout_str) if timeout_str and timeout_str != "None" else None
    ollama_client = ollama.Client(host=ollama_url, timeout=timeout)
    qdrant        = QdrantClient(url=qdrant_url, timeout=10)

    case_filter = Filter(
        must=[FieldCondition(key="case_id", match=MatchValue(value=case_id))]
    )

    filled: dict[str, str] = {}
    active_groups = SECTION_GROUPS
    total_groups = len(active_groups)
    _set_draft_progress(case_id, 0, total_groups, [])

    for i, group in enumerate(active_groups, 1):
        section_keys = list(group["sections"].keys())
        _set_draft_progress(case_id, i, total_groups, section_keys)
        logger.info(f"[draft] Group {i}/{total_groups}: {section_keys}")

        # 1. Embed the semantic query — combine query + section headings for richer retrieval
        combined_query = group["query"] + " " + " ".join(group["sections"].values())
        embed_resp  = ollama_client.embeddings(model=embed_model, prompt=combined_query)
        query_vec   = embed_resp.embedding

        # 2. Qdrant search — fetch more hits to get 3 unique sub-docs after dedup
        hits = qdrant.search(
            collection_name=QDRANT_COLLECTION,
            query_vector=query_vec,
            query_filter=case_filter,
            limit=15,
            with_payload=True,
        )

        # 3. Deduplicate by sub_document_id → fetch full content for up to 3 unique sub-docs
        MAX_SUBDOCS = 3
        content_blocks: list[str] = []
        seen_sd_ids: set[int]   = set()
        seen_fallback: set[tuple] = set()

        for hit in hits:
            if len(content_blocks) >= MAX_SUBDOCS:
                break
            p      = hit.payload or {}
            sd_id  = p.get("sub_document_id")
            doc_id = p.get("document_id")
            start  = p.get("start_page")

            # Dedup — prefer sub_document_id, fallback to (doc_id, start_page)
            if sd_id:
                if sd_id in seen_sd_ids:
                    continue
                seen_sd_ids.add(sd_id)
            else:
                key = (doc_id, start)
                if key in seen_fallback or doc_id is None or start is None:
                    continue
                seen_fallback.add(key)

            block = _fetch_content_from_db(db, doc_id, start, sd_id)
            if block:
                content_blocks.append(block)

        if not content_blocks:
            logger.warning(f"[draft] No Qdrant results for group {section_keys} — marking TO DO")
            for k in section_keys:
                filled[k] = TODO
            continue

        retrieved = "\n\n---\n\n".join(content_blocks)

        # 4. Build prompt for this group
        template_skeleton = json.dumps(
            {k: f"<{v}>" for k, v in group["sections"].items()},
            indent=2, ensure_ascii=False,
        )
        user_msg = (
            f"SOURCE CONTENT (retrieved from case documents):\n{retrieved}\n\n"
            f"SECTIONS TO FILL:\n{template_skeleton}\n\n"
            f"INSTRUCTIONS:\n"
            f"1. For each section, read the section heading carefully\n"
            f"2. From SOURCE CONTENT, identify the document title and the relevant content that matches the section heading\n"
            f"3. Extract and write the content in formal government report language (third person, past tense)\n"
            f"4. Use [NOT IN SOURCE] if the document type would not contain this information\n"
            f"5. Use [TO BE FILLED] if the information exists elsewhere but is missing from this source\n"
            f"6. Return valid JSON with identical keys. No markdown, no preamble."
        )

        # 5. Call Ollama
        response = ollama_client.chat(
            model=chat_model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": user_msg},
            ],
            format="json",
            options={"temperature": 0},
        )

        raw = response.message.content or "{}"
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            result = {}

        for k in section_keys:
            val = result.get(k)
            val = str(val).strip() if val is not None else ""
            filled[k] = val if len(val) > 10 else TODO

    # Populate table sections from extracted evidence (overrides AI-generated content if available)
    if document_id:
        try:
            _populate_table_sections(db, document_id, filled)
            logger.info(f"[draft] Populated table sections from extracted evidence (doc_id={document_id})")
        except Exception as exc:
            logger.warning(f"[draft] Table population failed: {exc} — using AI-generated tables")

    # Inject hardcoded legal texts — never touched by AI
    filled["10.6"] = SECTION_20_PC_ACT_TEXT
    filled["11.3"] = TCS_CONDUCT_RULES_TEXT
    filled["11.5"] = SECTION_7_DIFFERENCE_TEXT
    filled["11.6"] = INEVITABLE_CONCLUSION_TEXT
    filled["11.7"] = NO_NOTICE_REQUIRED_TEXT
    filled["11.8"] = SUPREME_COURT_CASES_TEXT
    filled["13.0"] = PROSECUTION_SANCTION_TEXT
    filled["13.4"] = SECTION_19_PC_ACT_TEXT

    _clear_draft_progress(case_id)
    return _assemble_output(filled, case_id)


# ── Assemble into frontend-expected structure ─────────────────────────────────

def _assemble_output(filled: dict[str, str], case_id: str) -> dict:
    sections = []
    for tmpl in TEMPLATE_STRUCTURE:
        subsections = []
        for sub_num in tmpl["subs"]:
            subsections.append({
                "number":  sub_num,
                "heading": _SUB_HEADINGS.get(sub_num, ""),
                "content": filled.get(sub_num, TODO),
            })
        sections.append({
            "number":     tmpl["number"],
            "heading":    tmpl["heading"],
            "subsections": subsections,
        })

    from datetime import date
    today = date.today().strftime("%d.%m.%Y")

    return {
        "case_id":      case_id,
        "office":       "Office of the Director General,\nAnti-Corruption Bureau,\nTG, Hyderabad.",
        "case_name":    case_id,
        "date":         today,
        "doc_title":    "CIRCULAR MEMORANDUM",
        "sub":          "Sub:-\tFinal Reports – Drafting of Final Reports in D.Es., R.Es. and R.Cs. – Instructions – Issued.",
        "case_number":  case_id,
        "sections":     sections,
        "generated_by": "rag",
    }
