import json
import logging
import os

from app.config import OLLAMA_EXTRACT_MODEL, OLLAMA_TIMEOUT, OLLAMA_URL

logger = logging.getLogger(__name__)

_MAX_WORDS = 6000

_EXTRACTION_PROMPT = """You are an expert legal, audit, investigation and government records analyst.

Analyze the following document text and extract structured information.

Extract:
1. Document Title
2. Subject
3. Purpose of the document
4. Main content (copy the substantive body text VERBATIM from the document — do NOT summarise, paraphrase, interpret, or add anything)
5. Executive summary (2-3 sentences)
6. Important dates (list of date strings)
7. Important people or persons mentioned (list of name strings)
8. Important organizations mentioned (list of strings)
9. Key findings (list of strings)
10. Key actions or decisions (list of strings)

Rules:
- Preserve factual accuracy. Do not invent information.
- main_content MUST be an exact verbatim copy of the document body. No rewording, no summarising, no additions, no omissions beyond what is in the source text.
- If a field is not present in the text, return null or empty list.
- Return valid JSON only. No markdown, no explanation.

Output format:
{
  "title": "",
  "subject": "",
  "purpose": "",
  "main_content": "",
  "executive_summary": "",
  "important_dates": [],
  "important_people": [],
  "important_organizations": [],
  "key_findings": [],
  "key_actions": []
}"""


def extract_content(full_text: str) -> dict:
    words = full_text.split()
    if len(words) > _MAX_WORDS:
        full_text = " ".join(words[:_MAX_WORDS])
        logger.debug(f"Truncated sub-doc to {_MAX_WORDS} words for extraction")

    try:
        return _extract_with_ollama(full_text)
    except Exception as exc:
        logger.warning(f"Content extraction failed: {exc}")
        return _empty_content()


def _extract_with_ollama(full_text: str) -> dict:
    import ollama

    ollama_url = os.getenv("OLLAMA_URL", OLLAMA_URL)
    model = os.getenv("OLLAMA_EXTRACT_MODEL", OLLAMA_EXTRACT_MODEL)

    timeout_str = os.getenv("OLLAMA_TIMEOUT", str(OLLAMA_TIMEOUT) if OLLAMA_TIMEOUT else "None")
    timeout = int(timeout_str) if timeout_str and timeout_str != "None" else None
    client = ollama.Client(host=ollama_url, timeout=timeout)
    response = client.chat(
        model=model,
        messages=[
            {"role": "system", "content": _EXTRACTION_PROMPT},
            {"role": "user", "content": full_text},
        ],
        format="json",
        options={"temperature": 0},
    )

    raw = response.message.content or "{}"
    return json.loads(raw)


def _empty_content() -> dict:
    return {
        "title": None,
        "subject": None,
        "purpose": None,
        "main_content": None,
        "executive_summary": None,
        "important_dates": [],
        "important_people": [],
        "important_organizations": [],
        "key_findings": [],
        "key_actions": [],
    }
