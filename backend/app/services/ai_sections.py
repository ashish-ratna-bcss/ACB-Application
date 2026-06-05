import json
import logging
import os
import re

from app.config import AI_BATCH_MAX_PAGES, AI_BATCH_MAX_WORDS, OLLAMA_CHAT_MODEL, OLLAMA_URL

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are an expert document parser analysing official investigation documents.

Given pages from a document (each marked with [PAGE N]), identify all sections and subsections.

Rules:
- A section starts when you see a heading, title, or clear topic change.
- Use the [PAGE N] markers to determine start_page and end_page accurately.
- Do NOT paraphrase or summarise content — copy it exactly as given.
- Return ONLY valid JSON, no markdown, no explanation.

Output schema:
{
  "sections": [
    {
      "title": "Exact Section Heading",
      "start_page": 1,
      "end_page": 3,
      "content": "Exact verbatim text belonging to this section"
    }
  ]
}"""


# ── Batching ─────────────────────────────────────────────────────────────────

def build_batches(
    page_texts: list[tuple[int, str]],
    max_pages: int = AI_BATCH_MAX_PAGES,
    max_words: int = AI_BATCH_MAX_WORDS,
) -> list[list[tuple[int, str]]]:
    batches: list[list[tuple[int, str]]] = []
    current: list[tuple[int, str]] = []
    word_count = 0

    for page_num, text in page_texts:
        wc = len(text.split())
        if current and (len(current) >= max_pages or word_count + wc > max_words):
            batches.append(current)
            current = []
            word_count = 0
        current.append((page_num, text))
        word_count += wc

    if current:
        batches.append(current)

    logger.info(f"Built {len(batches)} batch(es) from {len(page_texts)} page(s)")
    return batches


# ── Per-batch detection ───────────────────────────────────────────────────────

def detect_sections_in_batch(batch: list[tuple[int, str]]) -> list[dict]:
    # Build a lookup: page_number → original OCR text
    page_text_map: dict[int, str] = {pn: txt for pn, txt in batch}

    page_block = "\n\n".join(f"[PAGE {pn}]\n{txt}" for pn, txt in batch)

    try:
        sections = _detect_with_ollama(page_block)
    except Exception as exc:
        logger.warning(f"Ollama section detection failed: {exc} — using heuristic fallback")
        sections = _heuristic_detect(batch)

    # Replace AI-generated content with original OCR text for the page range
    # This guarantees content accuracy regardless of model behaviour
    for section in sections:
        start = section.get("start_page", batch[0][0])
        end = section.get("end_page", batch[-1][0])
        original_content = "\n".join(
            page_text_map[pn]
            for pn in sorted(page_text_map)
            if start <= pn <= end
        )
        if original_content.strip():
            section["content"] = original_content

    return sections


def _detect_with_ollama(page_block: str) -> list[dict]:
    import ollama

    ollama_url = os.getenv("OLLAMA_URL", OLLAMA_URL)
    model = os.getenv("OLLAMA_CHAT_MODEL", OLLAMA_CHAT_MODEL)

    client = ollama.Client(host=ollama_url)
    response = client.chat(
        model=model,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": page_block},
        ],
        format="json",
        options={"temperature": 0},
    )

    raw = response.message.content or "{}"
    data = json.loads(raw)
    sections = data.get("sections", [])
    logger.debug(f"Ollama returned {len(sections)} section(s)")
    return sections


# ── Heuristic fallback ────────────────────────────────────────────────────────

def _heuristic_detect(batch: list[tuple[int, str]]) -> list[dict]:
    """
    Fallback when Ollama is unavailable.
    Detects ALL-CAPS headings as section boundaries and tracks page numbers correctly.
    """
    if not batch:
        return []

    heading_re = re.compile(r"^([A-Z][A-Z0-9 \-:]{2,60})$")
    sections: list[dict] = []
    current_title: str | None = None
    current_start: int = batch[0][0]
    current_lines: list[str] = []

    def _flush(end_page: int) -> None:
        if current_title:
            sections.append({
                "title": current_title,
                "start_page": current_start,
                "end_page": end_page,
                "content": "\n".join(current_lines).strip(),
            })

    for page_num, text in batch:
        for line in text.splitlines():
            stripped = line.strip()
            if heading_re.match(stripped):
                _flush(page_num)
                current_title = stripped
                current_start = page_num
                current_lines = []
            else:
                current_lines.append(stripped)

    # Flush last section
    last_page = batch[-1][0]
    if current_title:
        _flush(last_page)
    elif not sections:
        # No headings found — whole batch is one section
        first_line = next(
            (l.strip() for _, t in batch for l in t.splitlines() if l.strip()),
            f"Pages {batch[0][0]}–{last_page}"
        )
        sections.append({
            "title": first_line[:80],
            "start_page": batch[0][0],
            "end_page": last_page,
            "content": "\n".join(t for _, t in batch),
        })

    return sections
