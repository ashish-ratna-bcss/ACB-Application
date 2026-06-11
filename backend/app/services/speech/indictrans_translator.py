"""
IndicTrans2 (AI4Bharat) translation for Indian languages.

Key advantage over Sarvam mayura:v1:
  - IndicProcessor normalises Indic number words → digits automatically
    (e.g. 'ఇరవై ఐదు' → '25', 'पच्चीस' → '25')
  - More natural, conversational output for Telugu / Hindi / Tamil etc.

Models (distilled, ~200-320 MB each, downloaded from HuggingFace on first use):
  en  → Indic  :  ai4bharat/indictrans2-en-indic-dist-200M
  Indic → en   :  ai4bharat/indictrans2-indic-en-dist-200M
  Indic → Indic:  ai4bharat/indictrans2-indic-indic-dist-320M

Install deps:
  pip install IndicTransToolkit sacremoses
"""

import logging
import re
import threading
from typing import Optional, Tuple, Any

logger = logging.getLogger(__name__)

# App language code → IndicTrans2 Flores-200 code
LANG_CODES: dict[str, str] = {
    "en": "eng_Latn",
    "hi": "hin_Deva",
    "te": "tel_Telu",
    "ta": "tam_Taml",
    "kn": "kan_Knda",
    "ml": "mal_Mlym",
    "mr": "mar_Deva",
    "gu": "guj_Gujr",
    "bn": "ben_Beng",
    "pa": "pan_Guru",
    "or": "ory_Orya",
    "as": "asm_Beng",
}

_MODEL_IDS: dict[str, str] = {
    "en-indic":    "ai4bharat/indictrans2-en-indic-dist-200M",
    "indic-en":    "ai4bharat/indictrans2-indic-en-dist-200M",
    "indic-indic": "ai4bharat/indictrans2-indic-indic-dist-320M",
}

# Cache: direction → (model, tokenizer, device, ip_or_None)
_models: dict[str, Tuple] = {}
_lock = threading.Lock()
_load_failed: set[str] = set()


def _direction(src: str, tgt: str) -> str:
    if src == "en":
        return "en-indic"
    if tgt == "en":
        return "indic-en"
    return "indic-indic"


def is_supported(src_lang: str, tgt_lang: str) -> bool:
    return src_lang in LANG_CODES and tgt_lang in LANG_CODES


def _load(direction: str) -> Tuple:
    """Load (and permanently cache) model + tokenizer + IndicProcessor for a direction."""
    if direction in _models:
        return _models[direction]
    if direction in _load_failed:
        raise RuntimeError(f"IndicTrans2 [{direction}] model failed to load previously — restart server to retry")

    try:
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model_id = _MODEL_IDS[direction]
        logger.info(f"[IndicTrans2] Loading {model_id} on {device}  (first-time download may take a few minutes)…")
        print(f"[IndicTrans2] Loading {model_id} on {device}  (first-time download may take a few minutes)…")

        tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
        model = AutoModelForSeq2SeqLM.from_pretrained(
            model_id,
            trust_remote_code=True,
            low_cpu_mem_usage=True,
        )
        if device == "cuda":
            model = model.half()   # fp16 on GPU — halves VRAM usage
        model = model.to(device)
        model.eval()

        # IndicProcessor handles: numeral normalisation, script normalisation, pre/post cleanup
        ip: Optional[Any] = None
        try:
            from IndicTransToolkit.processor import IndicProcessor
            ip = IndicProcessor(inference=True)
            logger.info("[IndicTrans2] IndicProcessor loaded — numeral normalisation active")
            print("[IndicTrans2] IndicProcessor loaded — numeral normalisation active")
        except ImportError:
            logger.warning(
                "[IndicTrans2] IndicTransToolkit not found — numeral normalisation disabled. "
                "Run: pip install IndicTransToolkit sacremoses"
            )

        _models[direction] = (model, tokenizer, device, ip)
        logger.info(f"[IndicTrans2] {direction} model ready on {device}")
        print(f"[IndicTrans2] ✅ {direction} model ready on {device}")
        return _models[direction]

    except Exception as exc:
        _load_failed.add(direction)
        raise RuntimeError(f"IndicTrans2 model load failed for [{direction}]: {exc}") from exc


def _chunk_text(text: str, max_chars: int = 450) -> list[str]:
    """Split text at sentence boundaries to keep each chunk within max_chars."""
    if len(text) <= max_chars:
        return [text]
    sentences = re.split(r'(?<=[.।?!\n])\s*', text)
    chunks: list[str] = []
    current = ""
    for sent in sentences:
        if not sent:
            continue
        if len(current) + len(sent) + 1 <= max_chars:
            current = (current + " " + sent).strip()
        else:
            if current:
                chunks.append(current)
            # A single sentence longer than max_chars → split by words
            if len(sent) > max_chars:
                words = sent.split()
                current = ""
                for w in words:
                    if len(current) + len(w) + 1 <= max_chars:
                        current = (current + " " + w).strip()
                    else:
                        if current:
                            chunks.append(current)
                        current = w
            else:
                current = sent
    if current:
        chunks.append(current)
    return chunks or [text]


def translate(text: str, src_lang: str, tgt_lang: str) -> str:
    """
    Translate text with IndicTrans2.

    Automatically normalises Indic number words to digits via IndicProcessor
    (the main fix for Telugu/Hindi date word → numeral conversion).

    Raises:
      ValueError   — unsupported language pair
      RuntimeError — model failed to load
    """
    import torch

    if src_lang == tgt_lang:
        return text

    if not is_supported(src_lang, tgt_lang):
        raise ValueError(f"IndicTrans2 does not support {src_lang} → {tgt_lang}")

    src_code = LANG_CODES[src_lang]
    tgt_code = LANG_CODES[tgt_lang]
    direction = _direction(src_lang, tgt_lang)

    with _lock:
        model, tokenizer, device, ip = _load(direction)

    chunks = _chunk_text(text)
    translated_parts: list[str] = []

    for chunk in chunks:
        # Preprocess (numeral normalisation happens here when ip is not None)
        batch = ip.preprocess_batch([chunk], src_lang=src_code, tgt_lang=tgt_code) if ip else [chunk]

        inputs = tokenizer(
            batch,
            truncation=True,
            padding="longest",
            max_length=256,
            return_tensors="pt",
        ).to(device)

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                num_beams=4,
                max_length=256,
                early_stopping=True,
            )

        decoded = tokenizer.batch_decode(
            outputs,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=True,
        )

        # Postprocess (script cleanup, de-tokenisation)
        if ip:
            decoded = ip.postprocess_batch(decoded, lang=tgt_code)

        translated_parts.extend(decoded)

    return " ".join(translated_parts).strip()
