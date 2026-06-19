import json
import logging
import re
from typing import TypedDict, Optional

logger = logging.getLogger(__name__)


# Structured evidence type definitions
class Witness(TypedDict):
    """Witness statement evidence"""
    name: str
    designation: Optional[str]
    address: Optional[str]
    role: Optional[str]
    statement_summary: Optional[str]


class CurrencyNote(TypedDict):
    """Physical currency evidence from trap operation"""
    serial_number: Optional[str]
    denomination: Optional[str]
    quantity: Optional[int]


class CDRRecord(TypedDict):
    """Call Data Record from telecom evidence"""
    date_time: Optional[str]
    ao_phone: Optional[str]
    complaint_phone: Optional[str]
    duration: Optional[str]
    cell_id: Optional[str]
    tower_location: Optional[str]


class Finding(TypedDict):
    """Substantiated finding/conclusion"""
    fact: str
    evidence: Optional[str]
    substantiated: bool
    relevant_sections: Optional[str]


class ExtractedEvidence(TypedDict):
    """Container for all extracted evidence from a subdocument"""
    witnesses: list[Witness]
    currency_notes: list[CurrencyNote]
    cdr_records: list[CDRRecord]
    findings: list[Finding]
    evidence_type: str  # Material | Oral | Documentary | Digital


def extract_witnesses(text: str) -> list[Witness]:
    """Extract witness information from subdocument text.

    Patterns:
    - "Name: X / Designation: Y / Address: Z"
    - "Witness X stated that..."
    - "Examination of X reveals..."
    """
    witnesses = []

    # Pattern 1: Structured witness entries
    pattern1 = r'Name:\s*([^/]+?)\s*/\s*Designation:\s*([^/]+?)\s*/\s*Address:\s*([^\n]+)'
    matches = re.finditer(pattern1, text, re.IGNORECASE)
    for m in matches:
        witnesses.append({
            "name": m.group(1).strip(),
            "designation": m.group(2).strip(),
            "address": m.group(3).strip(),
            "role": None,
            "statement_summary": None,
        })

    # Pattern 2: "Witness [Name] of [Designation]"
    pattern2 = r'Witness\s+([^,\n]+?)\s+(?:of|,)\s+([^,\n]+)'
    matches = re.finditer(pattern2, text, re.IGNORECASE)
    for m in matches:
        name = m.group(1).strip()
        # Check if already added
        if not any(w["name"].lower() == name.lower() for w in witnesses):
            witnesses.append({
                "name": name,
                "designation": m.group(2).strip(),
                "address": None,
                "role": None,
                "statement_summary": None,
            })

    # Pattern 3: Statement examination "Examination of [X] revealed that"
    pattern3 = r'Examination of ([^,]+?)\s+(?:revealed|shows|indicates|proves)\s+that\s+(.{50,200})'
    matches = re.finditer(pattern3, text, re.IGNORECASE)
    for m in matches:
        name = m.group(1).strip()
        # Check if already added
        if not any(w["name"].lower() == name.lower() for w in witnesses):
            witnesses.append({
                "name": name,
                "designation": None,
                "address": None,
                "role": None,
                "statement_summary": m.group(2).strip()[:100],
            })

    return witnesses


def extract_currency_notes(text: str) -> list[CurrencyNote]:
    """Extract currency note details from trap proceedings section.

    Patterns:
    - "Serial No. X | Denomination Rs. Y | Quantity Z"
    - "Note: Rs. 500 x 5 = Rs. 2,500"
    """
    notes = []

    # Pattern 1: Table format "Sl.No | Serial | Denomination"
    pattern1 = r'(?:Sl\.No|Serial|Note)?[\s|:]*([^\n|]{0,30}?)\s*\|\s*(?:Denom|Rs\.)\s*([0-9,]+)\s*(?:\||$)'
    matches = re.finditer(pattern1, text, re.IGNORECASE)
    for m in matches:
        serial = m.group(1).strip() if m.group(1) else None
        denom = m.group(2).strip() if m.group(2) else None
        if denom:
            notes.append({
                "serial_number": serial if serial and len(serial) > 1 else None,
                "denomination": denom,
                "quantity": 1,
            })

    # Pattern 2: "Rs. X,XXX × Y notes" or "Rs. 500 notes (qty: 5)"
    pattern2 = r'Rs\.?\s*([0-9,]+)\s*(?:×|x|notes)?\s*(?:\(qty:?\s*(\d+)\)|×\s*(\d+))?'
    matches = re.finditer(pattern2, text, re.IGNORECASE)
    for m in matches:
        amount = m.group(1).strip()
        qty = int(m.group(2) or m.group(3) or 1)
        # Check if already added
        if not any(n["denomination"] == amount for n in notes):
            notes.append({
                "serial_number": None,
                "denomination": amount,
                "quantity": qty,
            })

    return notes


def extract_cdr_records(text: str) -> list[CDRRecord]:
    """Extract Call Data Records from telecom evidence section.

    Patterns:
    - "Date/Time: DD.MM.YYYY HH:MM | AO Phone: 98XXXXXXX | Complaint Phone: 97XXXXXXX"
    - CDR table format with towers
    """
    records = []

    # Pattern 1: Structured CDR entries "Date/Time: X | Phone: Y | Duration: Z | Tower: W"
    pattern1 = r'(?:Date|DateTime)[\s/:]*([0-9.:\s]{10,30})\s*\|\s*(?:AO\s*)?Phone[\s/:]*([0-9]+)\s*\|\s*(?:Complaint\s*)?Phone[\s/:]*([0-9]+)\s*\|\s*Duration[\s/:]*([^|]+?)\s*\|\s*(?:Tower|Cell)[\s/:]*([^|\n]+)'
    matches = re.finditer(pattern1, text, re.IGNORECASE)
    for m in matches:
        records.append({
            "date_time": m.group(1).strip(),
            "ao_phone": m.group(2).strip(),
            "complaint_phone": m.group(3).strip(),
            "duration": m.group(4).strip(),
            "cell_id": None,
            "tower_location": m.group(5).strip() if m.group(5) else None,
        })

    # Pattern 2: Simpler format "HH:MM / Phone1 / Phone2 / Duration / Tower"
    pattern2 = r'(\d{2}:\d{2})\s*[/|]\s*(\d{10})\s*[/|]\s*(\d{10})\s*[/|]\s*(\d+\s*(?:min|sec|s))\s*[/|]\s*([^\n]+)'
    matches = re.finditer(pattern2, text, re.IGNORECASE)
    for m in matches:
        records.append({
            "date_time": m.group(1).strip(),
            "ao_phone": m.group(2).strip(),
            "complaint_phone": m.group(3).strip(),
            "duration": m.group(4).strip(),
            "cell_id": None,
            "tower_location": m.group(5).strip(),
        })

    return records


def extract_findings(text: str) -> list[Finding]:
    """Extract substantiated findings/conclusions from analysis/findings section.

    Patterns:
    - "Fact: X | Evidence: Y | Substantiated: Yes/No"
    - "It is established that X under Section Y"
    """
    findings = []

    # Pattern 1: Structured finding "Fact: X | Evidence: Y | Substantiated: Yes/No"
    pattern1 = r'Fact[\s:]*([^|]+?)\s*\|\s*Evidence[\s:]*([^|]+?)\s*\|\s*Substantiated[\s:]*([^|\n]+)'
    matches = re.finditer(pattern1, text, re.IGNORECASE)
    for m in matches:
        findings.append({
            "fact": m.group(1).strip(),
            "evidence": m.group(2).strip(),
            "substantiated": "yes" in m.group(3).lower(),
            "relevant_sections": None,
        })

    # Pattern 2: "It is established that X under Section Y"
    pattern2 = r'(?:It is (?:established|clear|proved) that|Established:)\s+([^.]+\.)\s*(?:under\s+Section\s+([0-9a-zA-Z()]+))?'
    matches = re.finditer(pattern2, text, re.IGNORECASE)
    for m in matches:
        findings.append({
            "fact": m.group(1).strip(),
            "evidence": None,
            "substantiated": True,
            "relevant_sections": m.group(2).strip() if m.group(2) else None,
        })

    # Pattern 3: "Offence under Section X is proved" (verdict-style)
    pattern3 = r'(?:Offence|Crime)\s+(?:under\s+)?Section\s+([0-9a-zA-Z()]+)\s+is\s+(proved|established|substantiated|not\s+proved)'
    matches = re.finditer(pattern3, text, re.IGNORECASE)
    for m in matches:
        substantiated = "not" not in m.group(2).lower()
        findings.append({
            "fact": f"Offence under Section {m.group(1)}",
            "evidence": None,
            "substantiated": substantiated,
            "relevant_sections": m.group(1).strip(),
        })

    return findings


def classify_evidence_type(text: str) -> str:
    """Classify evidence type based on content keywords.

    Returns: Material | Oral | Documentary | Digital
    """
    text_lower = text.lower()

    # Digital evidence keywords
    digital_keywords = ["audio", "video", "recording", "digital", "fsl", "transcription", "CDR", "cell tower"]
    if any(kw in text_lower for kw in digital_keywords):
        return "Digital"

    # Oral evidence keywords
    oral_keywords = ["statement", "examination", "witness", "said", "told", "conversation", "spoke"]
    if any(kw in text_lower for kw in oral_keywords):
        return "Oral"

    # Documentary evidence keywords
    doc_keywords = ["complaint", "FIR", "report", "letter", "document", "memo", "attendance", "record"]
    if any(kw in text_lower for kw in doc_keywords):
        return "Documentary"

    # Material evidence keywords (trap-related)
    material_keywords = ["currency", "phenolphthalein", "chemical", "trap", "seizure", "note", "physical"]
    if any(kw in text_lower for kw in material_keywords):
        return "Material"

    # Default to Material for trap-heavy documents, else Oral
    return "Material" if "trap" in text_lower else "Oral"


def extract_all_evidence(subdoc_content: str) -> ExtractedEvidence:
    """Main entry point: extract all evidence from subdocument content.

    Args:
        subdoc_content: Text from SubDocumentContent.main_content

    Returns:
        ExtractedEvidence dict with all extracted objects
    """
    if not subdoc_content:
        return {
            "witnesses": [],
            "currency_notes": [],
            "cdr_records": [],
            "findings": [],
            "evidence_type": "Unknown",
        }

    evidence_type = classify_evidence_type(subdoc_content)

    return {
        "witnesses": extract_witnesses(subdoc_content),
        "currency_notes": extract_currency_notes(subdoc_content),
        "cdr_records": extract_cdr_records(subdoc_content),
        "findings": extract_findings(subdoc_content),
        "evidence_type": evidence_type,
    }


def serialize_evidence(evidence: ExtractedEvidence) -> str:
    """Convert ExtractedEvidence to JSON string for database storage."""
    return json.dumps(evidence, indent=2)


def deserialize_evidence(evidence_json: str) -> ExtractedEvidence:
    """Convert JSON string from database back to ExtractedEvidence."""
    if not evidence_json:
        return {
            "witnesses": [],
            "currency_notes": [],
            "cdr_records": [],
            "findings": [],
            "evidence_type": "Unknown",
        }
    try:
        return json.loads(evidence_json)
    except (json.JSONDecodeError, ValueError):
        logger.warning(f"Failed to deserialize evidence JSON: {evidence_json[:100]}")
        return {
            "witnesses": [],
            "currency_notes": [],
            "cdr_records": [],
            "findings": [],
            "evidence_type": "Unknown",
        }
