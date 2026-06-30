import hashlib
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

from app.config import OLLAMA_EXTRACT_MODEL, OLLAMA_TIMEOUT, OLLAMA_URL, GEMINI_API_KEY, MISTRAL_API_KEY

logger = logging.getLogger(__name__)

_MAX_WORDS = 6000
_extraction_cache = {}

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


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:12]


def extract_content(full_text: str) -> dict:
    words = full_text.split()
    if len(words) > _MAX_WORDS:
        full_text = " ".join(words[:_MAX_WORDS])
        logger.debug(f"Truncated sub-doc to {_MAX_WORDS} words for extraction")

    text_hash = _content_hash(full_text)
    if text_hash in _extraction_cache:
        logger.debug(f"Cache hit for extraction: {text_hash}")
        return _extraction_cache[text_hash]

    try:
        # Try Gemini first
        try:
            logger.debug("Trying Gemini API for extraction...")
            result = _extract_with_gemini(full_text)
            _extraction_cache[text_hash] = result
            return result
        except Exception as gemini_exc:
            logger.warning(f"Gemini failed ({type(gemini_exc).__name__}), trying Mistral...")

            # Try Mistral second
            try:
                result = _extract_with_mistral(full_text)
                _extraction_cache[text_hash] = result
                return result
            except Exception as mistral_exc:
                logger.warning(f"Mistral failed ({type(mistral_exc).__name__}), falling back to Ollama...")

                # Fall back to Ollama
                result = _extract_with_ollama(full_text)
                _extraction_cache[text_hash] = result
                return result
    except Exception as exc:
        logger.error(f"Content extraction failed (all methods): {exc}")
        return _empty_content()


def extract_batch(texts: list[str]) -> list[dict]:
    """Extract content from multiple texts sequentially with caching."""
    results = []
    cached = 0

    for text in texts:
        text_hash = _content_hash(text)
        if text_hash in _extraction_cache:
            results.append(_extraction_cache[text_hash])
            cached += 1
        else:
            try:
                try:
                    logger.debug("Trying Gemini...")
                    result = _extract_with_gemini(text)
                except Exception as gemini_exc:
                    logger.debug(f"Gemini failed, trying Mistral...")
                    try:
                        result = _extract_with_mistral(text)
                    except Exception as mistral_exc:
                        logger.debug(f"Mistral failed, using Ollama...")
                        result = _extract_with_ollama(text)

                _extraction_cache[text_hash] = result
                results.append(result)
            except Exception as exc:
                logger.error(f"All extraction methods failed: {exc}")
                results.append(_empty_content())

    if cached:
        logger.info(f"Cache hits: {cached}/{len(texts)} extractions")

    return results


def _extract_with_mistral(full_text: str) -> dict:
    from mistralai.client import Mistral
    import time

    api_key = os.getenv("MISTRAL_API_KEY", MISTRAL_API_KEY)
    client = Mistral(api_key=api_key)

    try:
        start = time.time()
        response = client.chat.complete(
            model="mistral-large-latest",
            messages=[
                {"role": "system", "content": _EXTRACTION_PROMPT},
                {"role": "user", "content": full_text},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        elapsed = time.time() - start
        logger.info(f"Mistral extraction took {elapsed:.1f}s for {len(full_text)} chars")

        raw = response.choices[0].message.content or "{}"
        return json.loads(raw)
    except Exception as exc:
        logger.warning(f"Mistral extraction failed: {exc}")
        raise


def _extract_with_gemini(full_text: str) -> dict:
    import google.generativeai as genai
    import time

    api_key = os.getenv("GEMINI_API_KEY", GEMINI_API_KEY)
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    try:
        start = time.time()
        response = model.generate_content(
            [_EXTRACTION_PROMPT, full_text],
            generation_config=genai.types.GenerationConfig(
                temperature=0,
                response_mime_type="application/json",
            ),
        )
        elapsed = time.time() - start
        logger.info(f"Gemini extraction took {elapsed:.1f}s for {len(full_text)} chars")

        raw = response.text or "{}"
        return json.loads(raw)
    except Exception as exc:
        logger.warning(f"Gemini extraction failed: {exc}")
        raise


def _extract_with_ollama(full_text: str) -> dict:
    import ollama
    import time

    ollama_url = os.getenv("OLLAMA_URL", OLLAMA_URL)
    model = os.getenv("OLLAMA_EXTRACT_MODEL", OLLAMA_EXTRACT_MODEL)

    timeout_str = os.getenv("OLLAMA_TIMEOUT", str(OLLAMA_TIMEOUT) if OLLAMA_TIMEOUT else "None")
    timeout = int(timeout_str) if timeout_str and timeout_str != "None" else 120
    client = ollama.Client(host=ollama_url, timeout=timeout)

    start = time.time()
    response = client.chat(
        model=model,
        messages=[
            {"role": "system", "content": _EXTRACTION_PROMPT},
            {"role": "user", "content": full_text},
        ],
        format="json",
        options={"temperature": 0},
    )
    elapsed = time.time() - start
    logger.info(f"Ollama extraction took {elapsed:.1f}s for {len(full_text)} chars")

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
