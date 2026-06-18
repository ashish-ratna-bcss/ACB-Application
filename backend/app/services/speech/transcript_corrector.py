"""
TranscriptCorrector — Ollama-based cleanup layer for local STT diarized output.

Used only by the local (self-hosted) STT provider. The endpoint returns two
dialogues: `raw` (detected language) and `english` (free translation). This
layer cleans ONLY the raw turns — fixing grammar/spelling/word-boundary noise so
each diarization turn reads as a meaningful statement in its detected language.

Hard rules enforced via prompt + low temperature:
  - Output stays in the SAME detected language (e.g. Telugu → cleaned Telugu).
  - No new information, no added/irrelevant words, no translation, no merging turns.
  - The English dialogue is supplied only as MEANING CONTEXT to disambiguate, never copied.

Turns are corrected in small indexed BATCHES (one Ollama call per batch) to keep
latency sane on large recordings, while the per-turn index preserves
speaker/timestamp alignment with zero drift. Any batch that fails, times out, or
returns a mismatched count falls back to the original (uncorrected) turn text.
"""

import os
import json
from app.config import OLLAMA_URL, OLLAMA_CHAT_MODEL

# Wall-clock timeout per batch Ollama call (seconds). Caps worst-case hang.
CORRECTION_TIMEOUT = float(os.getenv("STT_CORRECTION_TIMEOUT", "90"))
# Fast reachability probe (seconds). If Ollama doesn't answer this quick, skip
# correction entirely and return raw immediately — no long per-batch timeouts.
CORRECTION_PROBE_TIMEOUT = float(os.getenv("STT_CORRECTION_PROBE_TIMEOUT", "3"))
# Turns per Ollama call. Smaller = faster per call but more calls.
CORRECTION_BATCH_SIZE = int(os.getenv("STT_CORRECTION_BATCH_SIZE", "20"))
# Master switch — defaults on for local provider.
CORRECTION_ENABLED = os.getenv("STT_CORRECTION_ENABLED", "true").lower() not in ("0", "false", "no")

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "te": "Telugu", "ta": "Tamil", "bn": "Bengali",
    "kn": "Kannada", "ml": "Malayalam", "mr": "Marathi", "gu": "Gujarati",
    "pa": "Punjabi", "or": "Odia", "ur": "Urdu", "as": "Assamese",
}

_SYSTEM_PROMPT = """You are a transcription cleanup assistant for police investigation recordings.

You receive a batch of diarized speech turns in {lang_name} ({lang_code}) produced by an automatic speech-to-text system. The raw text may contain spelling mistakes, broken word boundaries, missing punctuation, or fragmented phrasing.

Your ONLY job: rewrite each turn so it reads as a clean, grammatically correct, meaningful statement IN THE SAME LANGUAGE ({lang_name}).

STRICT RULES — follow exactly:
- Output MUST stay in {lang_name}. Do NOT translate to English or any other language.
- Do NOT add any new words, facts, names, numbers, or details not already implied by the raw text.
- Do NOT remove meaningful content. Only fix spelling, spacing, punctuation, and grammar.
- Do NOT merge, split, summarize, or reorder turns. Return EXACTLY one corrected turn per input turn, same index.
- An English translation of the FULL conversation is provided only as context to understand intended meaning. NEVER copy English words into the output.
- If a turn is already clean or you cannot confidently improve it, return it unchanged.

Respond ONLY with JSON of this exact shape, one object per input turn, preserving the "i" index:
{{"turns": [{{"i": 0, "corrected": "<cleaned turn in {lang_name}>"}}, {{"i": 1, "corrected": "..."}}]}}"""


def _correct_batch(client, model, system_prompt: str, english_context: str, batch: list) -> dict:
    """batch = list of (index, text). Returns {index: cleaned_text} for entries the model returned."""
    numbered = "\n".join(f'{idx}: {text}' for idx, text in batch)
    user_content = (
        f"FULL CONVERSATION (English, context only — do not copy):\n{english_context}\n\n"
        f"RAW TURNS TO CLEAN (keep each in original language, return same index):\n{numbered}"
    )
    response = client.chat(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        format="json",
        options={"temperature": 0},
    )
    data = json.loads(response.message.content or "{}")
    out = {}
    for entry in data.get("turns", []):
        if not isinstance(entry, dict):
            continue
        i = entry.get("i")
        cleaned = (entry.get("corrected") or "").strip()
        if isinstance(i, int) and cleaned:
            out[i] = cleaned
    return out


def correct_raw_segments(raw_segments: list, english_segments: list, detected_lang: str) -> list:
    """Return a new list of raw segments with cleaned `text`. Falls back to original on any error.

    Speaker/timestamp/id fields are preserved untouched — only `text` is rewritten.
    """
    if not CORRECTION_ENABLED or not raw_segments:
        return raw_segments

    try:
        import ollama
    except Exception:
        return raw_segments

    lang_code = detected_lang or "unknown"
    # No cleanup needed when the raw turns are already English.
    if lang_code == "en":
        return raw_segments

    lang_name = LANGUAGE_NAMES.get(lang_code, lang_code)
    system_prompt = _SYSTEM_PROMPT.format(lang_name=lang_name, lang_code=lang_code)
    english_context = " ".join(s.get("text", "") for s in english_segments).strip() or "(no English translation available)"

    ollama_url = os.getenv("OLLAMA_URL", OLLAMA_URL)
    model = os.getenv("OLLAMA_CHAT_MODEL", OLLAMA_CHAT_MODEL)

    # Fast reachability probe — if Ollama is down/unreachable, bail out in seconds
    # instead of eating CORRECTION_TIMEOUT on every batch.
    try:
        import requests
        requests.get(f"{ollama_url.rstrip('/')}/api/version", timeout=CORRECTION_PROBE_TIMEOUT)
    except Exception as exc:
        print(f"[TranscriptCorrector] Ollama unreachable ({exc}) — skipping correction, returning raw")
        return raw_segments

    try:
        client = ollama.Client(host=ollama_url, timeout=CORRECTION_TIMEOUT)
    except Exception:
        return raw_segments

    # Index every non-empty turn, then split into batches.
    indexed = [(i, seg.get("text", "")) for i, seg in enumerate(raw_segments) if seg.get("text", "").strip()]
    cleaned_map = {}
    for start in range(0, len(indexed), CORRECTION_BATCH_SIZE):
        batch = indexed[start:start + CORRECTION_BATCH_SIZE]
        try:
            cleaned_map.update(_correct_batch(client, model, system_prompt, english_context, batch))
        except Exception as exc:
            print(f"[TranscriptCorrector] batch {start // CORRECTION_BATCH_SIZE} failed, keeping original: {exc}")
            # leave this batch uncorrected — original text kept below

    corrected = []
    fixed_count = 0
    for i, seg in enumerate(raw_segments):
        new_seg = dict(seg)
        original = seg.get("text", "")
        cleaned = cleaned_map.get(i)
        if cleaned and cleaned != original:
            new_seg["text"] = cleaned
            fixed_count += 1
        corrected.append(new_seg)

    print(f"[TranscriptCorrector] {lang_name}: cleaned {fixed_count}/{len(raw_segments)} turns "
          f"in {len(range(0, len(indexed), CORRECTION_BATCH_SIZE))} batch(es)")
    return corrected
