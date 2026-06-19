"""
Table generation utilities for formatted investigation reports.

Generates HTML tables for currency notes, CDR records, witness lists,
abstract findings, and evidence transcripts with exact verbatim preservation.
"""

def generate_currency_table(notes: list[dict]) -> str:
    """Generate currency notes table: Sl.No | Currency Number | Denomination"""
    if not notes:
        return ""

    html = '<table border="1" cellpadding="5" cellspacing="0">'
    html += '<tr><th>Sl.No.</th><th>Currency Number</th><th>Denomination</th></tr>'

    for i, note in enumerate(notes, 1):
        html += f'<tr>'
        html += f'<td>{i}</td>'
        html += f'<td>{note.get("serial_number", "")}</td>'
        html += f'<td>{note.get("denomination", "")}</td>'
        html += f'</tr>'

    html += '</table>'
    return html


def generate_cdr_table(records: list[dict]) -> str:
    """Generate CDR table: Sl.No | Date-Time | AO Phone | Complaint Phone | Duration | Cell ID | Tower Location"""
    if not records:
        return ""

    html = '<table border="1" cellpadding="5" cellspacing="0">'
    html += '<tr><th>Sl.No</th><th>Date and Time</th><th>AO\'s Mobile Number</th><th>Complainant\'s Mobile No</th><th>Call Duration</th><th>Cell ID</th><th>Tower Location of AO</th></tr>'

    for i, record in enumerate(records, 1):
        html += f'<tr>'
        html += f'<td>{i}</td>'
        html += f'<td>{record.get("date_time", "")}</td>'
        html += f'<td>{record.get("ao_phone", "")}</td>'
        html += f'<td>{record.get("complaint_phone", "")}</td>'
        html += f'<td>{record.get("duration", "")}</td>'
        html += f'<td>{record.get("cell_id", "")}</td>'
        html += f'<td>{record.get("tower_location", "")}</td>'
        html += f'</tr>'

    html += '</table>'
    return html


def generate_witness_list(witnesses: list[dict]) -> str:
    """Format witness list: Name (bold) | Designation | Address | Role"""
    if not witnesses:
        return ""

    lines = []
    for witness in witnesses:
        name = witness.get("name", "")
        designation = witness.get("designation", "")
        address = witness.get("address", "")
        role = witness.get("role", "")

        line = f"<b>{name}</b>, {designation}, {address}. ({role})"
        lines.append(line)

    return "<br>".join(lines)


def generate_abstract_table(findings: list[dict]) -> str:
    """Generate abstract table: Sl.No | Gist | AO/Person | Substantiated | Recommendation"""
    if not findings:
        return ""

    html = '<table border="1" cellpadding="5" cellspacing="0">'
    html += '<tr><th>Sl.No.</th><th>Gist of Allegation</th><th>AO/Person</th><th>Substantiated</th><th>Recommendations</th></tr>'

    for i, finding in enumerate(findings, 1):
        html += f'<tr>'
        html += f'<td>{i}</td>'
        html += f'<td>{finding.get("gist", "")}</td>'
        html += f'<td>{finding.get("person", "")}</td>'
        html += f'<td>{finding.get("substantiated", "")}</td>'
        html += f'<td>{finding.get("recommendation", "")}</td>'
        html += f'</tr>'

    html += '</table>'
    return html


def generate_transcript_table(transcript: dict) -> str:
    """Generate transcript table: Sl.No | Clip Duration | Speaker | Conversation (verbatim, preserve Telugu)"""
    if not transcript:
        return ""

    html = '<table border="1" cellpadding="5" cellspacing="0">'
    html += '<tr><th>Clip Duration</th><th>Speaker</th><th>Conversation</th></tr>'

    entries = transcript.get("entries", [])
    for entry in entries:
        html += f'<tr>'
        html += f'<td>{entry.get("time", "")}</td>'
        html += f'<td>{entry.get("speaker", "")}</td>'
        html += f'<td>{entry.get("text", "")}</td>'  # Preserve verbatim, including Telugu
        html += f'</tr>'

    html += '</table>'
    return html


def format_currency_notes_section(notes: list[dict]) -> str:
    """Format currency notes with description + table"""
    if not notes:
        return ""

    total_amount = sum(float(note.get("amount", 0)) for note in notes if note.get("amount"))
    count = len(notes)

    text = f"The total amount was Rs.{total_amount:,.0f}/- and currency notes were {count} in Nos.\n\n"
    text += generate_currency_table(notes)

    return text


def format_evidence_list(evidence_items: list[str]) -> str:
    """Format evidence list with ➢ bullets"""
    if not evidence_items:
        return ""

    lines = [f"➢ {item}" for item in evidence_items]
    return "\n".join(lines)


def format_section_header(section_number: str, title: str) -> str:
    """Format section header: X.Y. Title:"""
    return f"{section_number}. {title}:"
