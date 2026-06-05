import json
import logging
import os

from app.config import AI_BATCH_MAX_PAGES, AI_BATCH_MAX_WORDS, OLLAMA_CHAT_MODEL, OLLAMA_TIMEOUT, OLLAMA_URL

logger = logging.getLogger(__name__)

_DETECTION_PROMPT = """You are an expert legal and government document analyst.

You are given OCR text extracted from consecutive pages of a large PDF document.

The PDF may contain multiple INDEPENDENT sub-documents merged together.

Sub-document types:
- Letter (To/From/Subject format)
- Investigation Report
- Preliminary Enquiry Report
- Witness Statement
- Charge Sheet
- Order (O., C.O., G.O.)
- Proceedings
- Government Communication
- Audit Report
- MEMO
- FIR Report
- Other

ABSOLUTE SPLIT RULES (MANDATORY - NO EXCEPTIONS):

1. At ANY page start, if you see these keywords, it is a NEW DOCUMENT:
   - "MEMO", "Memo", "MEMORANDUM"
   - "C.O.", "G.O.", "G.M.O." (Circular Order, Government Order)
   - "FIR", "First Information Report"
   - After seeing signature + date on previous page, then "MEMO" or "C.O." = NEW DOCUMENT

2. REFERENCE NUMBER CHANGES = ALWAYS SPLIT:
   - "L.No." → "C.O." = SPLIT
   - "L.No." → "Cr.No." = SPLIT
   - "Cr.No." → numeric ID (e.g., "8558") = SPLIT
   - Numeric ID (e.g., "8558") → "MEMO" = SPLIT
   - Any reference prefix change = NEW DOCUMENT

3. At page start, if you see:
   - "To," or "To:" with a new recipient ≠ previous → NEW LETTER = NEW DOCUMENT
   - "Office of the [Director/Commissioner]" + new date after signature block → NEW DOCUMENT
   - "Sir," or "Dear Sir" at page start (without continuation from page before) → NEW DOCUMENT
   - Date + reference # in format "Date:XX-X-XXXX" at page top = likely new doc start

4. Signature block (name, designation, date) + then new page content = ALWAYS CHECK IF NEW
   - If next page has new "To:" or new reference number = SPLIT
   - If next page has "MEMO", "C.O.", "FIR" = SPLIT

EXAMPLE (document 29):
- Page 1-2: L.No.50/RCT-NMD/2004 Letter → Page 3: C.O.50//2004 = SPLIT (L.No. → C.O.)
- Page 3: C.O. → Page 4: Cr.No.5 = SPLIT (C.O. → Cr.No.)
- Page 5 (ends letter) → Page 6: MEMO = SPLIT (letter ends, MEMO starts)

Rules:
- Count reference number prefixes: each DIFFERENT prefix = different document
- Do NOT assume documents with same number (50) are related if prefix differs
- Same reference number + same prefix = same document only
- Return valid JSON only. No markdown, no explanation.

FOR EACH DOCUMENT, you MUST identify and list:
- Reference number (e.g., "L.No.50/RCT-NMD/2004", "C.O.50//2004", "Cr.No.5/ACB-NZB/2004")
- Document type (Letter, Order, FIR, Memo, Report)
- Start page (EXACT page number from [PAGE X] label where this document begins)
- End page (EXACT page number from [PAGE X] label where this document ends)

IMPORTANT PAGE NUMBERING:
- Input shows [PAGE 4], [PAGE 5], [PAGE 6] → output must use start_page: 4, end_page: 6
- DO NOT renumber pages (e.g., don't say 1-3 for [PAGE 4-6])
- Match the [PAGE X] numbers exactly in your output

Output format (MUST include reference_number and reference_prefix):
{
  "documents": [
    {
      "title": "string",
      "document_type": "string",
      "reference_number": "L.No.50/RCT-NMD/2004",
      "reference_prefix": "L.No.",
      "start_page": 4,
      "end_page": 6,
      "confidence": 0.95
    }
  ]
}"""


def detect_subdocuments(page_texts: list[tuple[int, str]]) -> list[dict]:
    if not page_texts:
        return []

    # Build page map for reference-based splitting
    page_map = {pn: txt for pn, txt in page_texts}
    max_page = max((pn for pn, _ in page_texts), default=0)

    batches = _build_batches(page_texts)
    logger.info(f"Sub-doc detection: {len(page_texts)} pages → {len(batches)} batch(es)")

    all_subdocs: list[dict] = []
    for i, batch in enumerate(batches, 1):
        batch_pages = f"{batch[0][0]}–{batch[-1][0]}"
        logger.info(f"  Batch {i}/{len(batches)}: pages {batch_pages} ({len(batch)} pages)")
        try:
            result = _detect_batch(batch)
            if result:
                all_subdocs.extend(result)
            else:
                all_subdocs.extend(_fallback_single(batch))
        except Exception as exc:
            logger.warning(f"  Batch {i} failed: {exc} — using fallback")
            all_subdocs.extend(_fallback_single(batch))

    if not all_subdocs:
        return _fallback_single(page_texts)

    # Cap end_pages to document max (fix hallucinations)
    for doc in all_subdocs:
        if doc.get("end_page", 0) > max_page:
            doc["end_page"] = max_page

    resolved = _resolve_overlaps(all_subdocs)
    merged = _merge_across_boundaries(resolved)
    split = _split_by_reference_changes(merged, page_map)
    logger.info(f"Sub-doc detection complete: {len(split)} sub-doc(s) after all processing")
    return split


def _build_batches(
    page_texts: list[tuple[int, str]],
) -> list[list[tuple[int, str]]]:
    """Split pages into batches respecting AI_BATCH_MAX_PAGES and AI_BATCH_MAX_WORDS."""
    batches: list[list[tuple[int, str]]] = []
    current: list[tuple[int, str]] = []
    current_words = 0

    for page_num, text in page_texts:
        page_words = len(text.split())
        if current and (
            len(current) >= AI_BATCH_MAX_PAGES
            or current_words + page_words > AI_BATCH_MAX_WORDS
        ):
            batches.append(current)
            current = []
            current_words = 0
        current.append((page_num, text))
        current_words += page_words

    if current:
        batches.append(current)

    return batches


def _detect_batch(batch: list[tuple[int, str]]) -> list[dict]:
    import ollama

    ollama_url = os.getenv("OLLAMA_URL", OLLAMA_URL)
    model = os.getenv("OLLAMA_CHAT_MODEL", OLLAMA_CHAT_MODEL)

    page_block = "\n\n".join(f"[PAGE {pn}]\n{txt}" for pn, txt in batch)

    timeout_str = os.getenv("OLLAMA_TIMEOUT", str(OLLAMA_TIMEOUT) if OLLAMA_TIMEOUT else "None")
    timeout = int(timeout_str) if timeout_str and timeout_str != "None" else None
    client = ollama.Client(host=ollama_url, timeout=timeout)
    response = client.chat(
        model=model,
        messages=[
            {"role": "system", "content": _DETECTION_PROMPT},
            {"role": "user", "content": page_block},
        ],
        format="json",
        options={"temperature": 0},
    )

    raw = response.message.content or "{}"
    data = json.loads(raw)
    return data.get("documents", [])


def _extract_reference_markers(text: str) -> list[str]:
    """Extract document reference markers from text (L.No., C.O., Cr.No., MEMO, etc.)"""
    import re
    markers = []

    # Look for explicit reference patterns
    patterns = [
        r'L\.No\.\s*[\w\./\-]+',      # L.No.50/RCT-NMD/2004
        r'C\.O\.\s*[\w\./\-]+',       # C.O.50//2004
        r'Cr\.No\.\s*[\w\./\-]+',     # Cr.No.5/ACB-NZB/2004
        r'(?:^|\n)MEMO\b',            # MEMO keyword
        r'(?:^|\n)(?:FIR|Order)',     # FIR, Order keywords
    ]

    for pattern in patterns:
        found = re.findall(pattern, text, re.MULTILINE | re.IGNORECASE)
        markers.extend(found)

    return markers


def _infer_doc_title(page_text: str) -> str:
    """Infer document title from first page."""
    lines = page_text.split('\n')
    for line in lines[:20]:
        line = line.strip()
        if not line or len(line) < 3:
            continue
        # Skip common prefixes
        if line in ["SECRET", "Office of the Director-Gonoral", "Anti-Corruption Bureau", "A.P. lyuerabed."]:
            continue
        # Take first substantial line as title
        if len(line) > 10:
            return line[:80]
    return "Document"


def _split_by_reference_changes(subdocs: list[dict], page_map: dict[int, str]) -> list[dict]:
    """Post-process detected documents by splitting at reference number changes within page ranges."""
    if not subdocs or not page_map:
        return subdocs

    result = []

    for doc in subdocs:
        start_page = doc.get("start_page", 0)
        end_page = doc.get("end_page", 0)

        if start_page < 1 or end_page < start_page:
            result.append(doc)
            continue

        # Extract reference from first page
        first_page_text = page_map.get(start_page, "")
        first_markers = _extract_reference_markers(first_page_text[:500])  # Check first 500 chars
        first_ref = first_markers[0] if first_markers else None

        # Look for reference changes in subsequent pages
        split_points = []
        for page_num in range(start_page + 1, end_page + 1):
            page_text = page_map.get(page_num, "")
            if not page_text:
                continue

            markers = _extract_reference_markers(page_text[:500])
            current_ref = markers[0] if markers else None

            # If reference changed, mark as split point
            if current_ref and first_ref and current_ref != first_ref:
                split_points.append(page_num)
                logger.debug(f"Found reference change at page {page_num}: '{first_ref}' → '{current_ref}'")
                first_ref = current_ref

        # If no splits needed, keep original
        if not split_points:
            result.append(doc)
        else:
            # Create split documents with updated titles
            prev_start = start_page
            for split_page in split_points:
                new_doc = dict(doc)
                new_doc["start_page"] = prev_start
                new_doc["end_page"] = split_page - 1
                # Infer title from first page of this segment
                seg_page_text = page_map.get(prev_start, "")
                new_doc["title"] = _infer_doc_title(seg_page_text)
                result.append(new_doc)
                prev_start = split_page

            # Add final segment
            if prev_start <= end_page:
                new_doc = dict(doc)
                new_doc["start_page"] = prev_start
                new_doc["end_page"] = end_page
                seg_page_text = page_map.get(prev_start, "")
                new_doc["title"] = _infer_doc_title(seg_page_text)
                result.append(new_doc)

    return result


def _resolve_overlaps(subdocs: list[dict]) -> list[dict]:
    """Resolve page overlaps when one doc's end_page equals another doc's start_page.
    Rule: if page N is both end_page of doc A and start_page of doc B, assign to doc B (newer doc).
    """
    if len(subdocs) < 2:
        return subdocs

    sorted_docs = sorted(subdocs, key=lambda d: d.get("start_page", 0))
    result = []

    for i, doc in enumerate(sorted_docs):
        if i < len(sorted_docs) - 1:
            next_doc = sorted_docs[i + 1]
            curr_end = doc.get("end_page", 0)
            next_start = next_doc.get("start_page", 0)

            # If this doc's end equals next doc's start, adjust this doc's end
            if curr_end == next_start and curr_end > 0:
                doc["end_page"] = curr_end - 1
                logger.debug(f"Resolved overlap: '{doc['title']}' now ends at page {doc['end_page']}, '{next_doc['title']}' starts at page {next_start}")

        result.append(doc)

    return result


def _merge_across_boundaries(subdocs: list[dict]) -> list[dict]:
    """Merge consecutive sub-docs with same reference_prefix that share contiguous page ranges.

    When the same document spans two batches, detection returns two adjacent entries
    with identical reference prefixes (L.No., C.O., Cr.No., etc.). Different prefixes = different docs.
    """
    if not subdocs:
        return subdocs

    sorted_docs = sorted(subdocs, key=lambda d: d.get("start_page", 0))
    merged = [dict(sorted_docs[0])]

    for current in sorted_docs[1:]:
        prev = merged[-1]
        prev_end   = prev.get("end_page", 0)
        curr_start = current.get("start_page", 0)
        prev_prefix = prev.get("reference_prefix", "")
        curr_prefix = current.get("reference_prefix", "")

        # Contiguous pages + SAME reference prefix → merge (even if type differs slightly)
        # Different prefix → NEVER merge (different documents)
        contiguous  = curr_start <= prev_end + 1
        same_prefix = prev_prefix == curr_prefix and prev_prefix != ""

        if contiguous and same_prefix:
            prev["end_page"]   = max(prev_end, current.get("end_page", 0))
            prev["confidence"] = min(
                prev.get("confidence", 1.0), current.get("confidence", 1.0)
            )
            logger.debug(f"Merged '{prev['title']}' (prefix {prev_prefix}) across batch boundary (pp {prev['start_page']}–{prev['end_page']})")
        else:
            merged.append(dict(current))

    return merged


def _fallback_single(page_texts: list[tuple[int, str]]) -> list[dict]:
    first_line = next(
        (line.strip() for _, t in page_texts for line in t.splitlines() if line.strip()),
        "Document",
    )
    return [{
        "title": first_line[:80],
        "document_type": "Unknown",
        "start_page": page_texts[0][0],
        "end_page":   page_texts[-1][0],
        "confidence": 0.5,
    }]
