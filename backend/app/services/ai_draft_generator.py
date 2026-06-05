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

# ── Template: section groups with semantic queries ────────────────────────────
# Each group = one Qdrant search + one Ollama call.
# 'query' is what gets embedded to find relevant sub-docs.
# 'sections' maps section-number → heading shown to AI.

SECTION_GROUPS = [
    {
        "query": "background of the case introduction overview complaint investigation summary",
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

_SYSTEM_PROMPT = """You are a Senior Anti-Corruption Bureau Investigation Officer and Legal Drafting Expert writing an official Final Report in a Trap Case for submission to Government authorities for obtaining Prosecution Sanction under the Prevention of Corruption Act, 1988 (as amended in 2018).

STRICT RULES — follow without exception:

RULE 1: Never create facts. Do not invent names, dates, times, amounts, witnesses, documents, statements, findings, or legal sections. If evidence is unavailable for a section, write exactly: TO DO

RULE 2: Use ONLY facts explicitly stated in SOURCE CONTENT. Never use outside knowledge, never infer, never assume.

RULE 3: Preserve names, designations, dates, amounts, case numbers, FIR numbers, and section numbers EXACTLY as they appear in SOURCE CONTENT. Do not paraphrase or approximate.

RULE 4: Write in formal government report style — third person, past tense, long narrative paragraphs, legal terminology, formal investigation narration, neutral factual tone. Do not use bullet points unless the section explicitly requires it.

RULE 5: Maintain strict chronology: Complaint → Verification → FIR → Pre-Trap → Trap → Post-Trap → Investigation → Findings.

RULE 6: Every conclusion must cite its evidence source. For each finding, mention the specific witness evidence, documentary evidence, digital evidence, or scientific evidence that supports it.

RULE 7: Verbatim transcripts must be reproduced exactly. When SOURCE CONTENT contains recorded conversation transcripts (demand/acceptance exchanges), copy them word-for-word. Do not paraphrase recorded conversations.

RULE 8: When discussing witnesses, always state name, designation, and connection to the case.

RULE 9: Amounts, denominations, and serial numbers of currency notes must match SOURCE CONTENT exactly.

RULE 10: Phenolphthalein / sodium carbonate test results must use the exact scientific terminology from SOURCE CONTENT.

RULE 11: Official record references (file numbers, application numbers, register numbers) must be reproduced exactly from SOURCE CONTENT.

RULE 12: Tabular data (CDR records, currency serial number tables, video/audio hash value tables) must be reproduced exactly. Do not summarize tables.

RULE 13: Telugu or other regional language text in SOURCE CONTENT must be copied verbatim. Do not translate, transliterate, or paraphrase regional language content.

RULE 14: Return valid JSON only. Keys must exactly match the section numbers given. No markdown. No preamble. No explanation outside the JSON.

RULE 15: CONTENT FILTERING — Extract only information relevant to each section. Ignore unrelated content from source documents. Do NOT include facts that belong in other sections. Focus on main narrative content; skip metadata, summaries, and document headers unless directly relevant to the section heading.

FORMATTING RULES — apply to all sections:

FORMAT 1: Section headers follow pattern "X.Y. Section Title:" (numbered with period, space, title, colon)

FORMAT 2: Evidence lists use ➢ bullets: "Evidence for Demand is proved by the following..." followed by ➢-bulleted evidence types (one bullet per evidence category)

FORMAT 3: Bold formatting: **names** of persons, **Section 7(a)**, **case citations**, **key document types**

FORMAT 4: Narrative style: formal prose (third-person, past tense), NO bullet points in narrative paragraphs. Bullets only in evidence lists under "Evidence for X is proved by..."

FORMAT 5: Amounts: exact format Rs.X,XXX/- (Rs. prefix, number with comma, hyphen, no decimal unless in source)

FORMAT 6: Dates: DD.MM.YYYY format (match source exactly)

FORMAT 7: Table references: mention tables inline as "[Table 6.1: Currency Notes with serial numbers and denominations]" then follow with table data

FORMAT 8: Transcripts: preserve verbatim including Telugu/regional text, add timestamps in format [MM:SS] before speaker, format as: "[MM:SS] Speaker | Exact conversation text"

FORMAT 9: Verbatim preservation: Serial numbers, case numbers, application numbers, FIR numbers, phone numbers, IMEI, CDR data, chemical test terminology, regional language — all EXACTLY as in source

FORMAT 10: Case citations: (Year) Reporter SCC Page-AIR Year SC Page (e.g., (1995) 6 SCC 225-AIR 1996 SC 186)

FORMAT 11: Call Data Records: table with columns [Sl.No | Date-Time | AO's mobile | Complaint's mobile | Duration | Cell ID | Tower Location] — preserve exact timestamps HH:MM:SS and full tower addresses

FORMAT 12: Evidence categorization: when listing evidence types, group by category (Oral Evidence, Documentary Evidence, Digital Evidence, Material Evidence) with ➢ bullets under each

FORMAT 13: Currency tables: For section 6.3, extract and format as: "The total amount was Rs.X,XXX/- consisting of Y notes" followed by structured table with Sl.No | Serial Number | Denomination columns

FORMAT 14: CDR tables: For section 14.1, extract exact timestamp HH:MM:SS format, preserve full tower location names, list all communication events in chronological order with complete metadata

FORMAT 15: Witness lists: Always include full name (bold), designation, address, and role/connection to case in single formatted line

FORMAT 16: Section numbering: Maintain X.Y format for all sub-sections, do not use decimals beyond one level

FORMAT 17: Evidence introductions: Every evidence type section should start with "Evidence for [topic] is proved by the following:" followed by ➢ bullets

FORMAT 18: Narrative flow: Connect evidence chronologically, maintain formal tone throughout, use transitional phrases like "Thereupon", "Subsequently", "As a result", "In view of above"

FORMAT 19: Key findings emphasis: Important conclusions should be stated clearly in formal language, followed by specific evidence citation

FORMAT 20: Preserve exact terminology: Use exact terminology from SOURCE for technical terms (phenolphthalein, chemical test, IMEI, CDR), official titles, and designations"""


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


# ── Main entry point ──────────────────────────────────────────────────────────

def generate_draft_rag(case_id: str, db) -> dict:
    """
    Generate draft using RAG (Qdrant + Ollama).
    Raises on failure so caller can fall back to mechanical generator.
    """
    import ollama
    from qdrant_client import QdrantClient
    from qdrant_client.models import FieldCondition, Filter, MatchValue

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

    for i, group in enumerate(SECTION_GROUPS, 1):
        section_keys = list(group["sections"].keys())
        logger.info(f"[draft] Group {i}/{len(SECTION_GROUPS)}: {section_keys}")

        # 1. Embed the semantic query
        embed_resp  = ollama_client.embeddings(model=embed_model, prompt=group["query"])
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
            f"SOURCE CONTENT (retrieved from uploaded case documents):\n{retrieved}\n\n"
            f"EXTRACT AND FILL THESE TEMPLATE SECTIONS:\n"
            f"{template_skeleton}\n\n"
            f"EXTRACTION INSTRUCTIONS:\n"
            f"1. For each section, extract ONLY the information directly relevant to that section heading\n"
            f"2. Ignore unrelated content from the source documents\n"
            f"3. Do NOT include information that belongs in other sections\n"
            f"4. Focus on main content; skip metadata and summaries\n"
            f"5. Use \"TO DO\" for any section where specific information is not found in SOURCE CONTENT\n"
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
            options={"temperature": 0, "num_ctx": 16384},
        )

        raw = response.message.content or "{}"
        try:
            result = json.loads(raw)
        except json.JSONDecodeError:
            result = {}

        for k in section_keys:
            filled[k] = str(result.get(k) or TODO).strip() or TODO

    # Inject hardcoded legal texts — never touched by AI
    filled["10.6"] = SECTION_20_PC_ACT_TEXT
    filled["11.3"] = TCS_CONDUCT_RULES_TEXT
    filled["11.5"] = SECTION_7_DIFFERENCE_TEXT
    filled["11.6"] = INEVITABLE_CONCLUSION_TEXT
    filled["11.7"] = NO_NOTICE_REQUIRED_TEXT
    filled["11.8"] = SUPREME_COURT_CASES_TEXT
    filled["13.0"] = PROSECUTION_SANCTION_TEXT
    filled["13.4"] = SECTION_19_PC_ACT_TEXT

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

    return {
        "case_id":      case_id,
        "title":        "FORMAT FOR FINAL REPORT IN TRAP CASES",
        "case_number":  case_id,
        "sections":     sections,
        "generated_by": "rag",
    }
