"""
SarvamTranscriber — Indian Regional Language Transcription via Sarvam AI API.
Handles audio chunking for recordings > 25 seconds (Sarvam limit: 30s).
"""

import os
import io
import re
import time
import wave
import tempfile
import numpy as np
import requests

# Languages supported by Sarvam AI with their BCP-47 codes
SARVAM_LANGUAGE_MAP = {
    "en": "en-IN",   # English
    "hi": "hi-IN",   # Hindi
    "te": "te-IN",   # Telugu
    "ta": "ta-IN",   # Tamil
    "bn": "bn-IN",   # Bengali
    "kn": "kn-IN",   # Kannada
    "ml": "ml-IN",   # Malayalam
    "mr": "mr-IN",   # Marathi
    "gu": "gu-IN",   # Gujarati
    "pa": "pa-IN",   # Punjabi
    "or": "od-IN",   # Odia (Sarvam uses od-IN)
    "as": "as-IN",   # Assamese
}

# Languages that should request punctuation from Sarvam API
PUNCTUATE_LANGUAGES = {"en", "te", "hi", "ta", "or", "ml", "kn", "bn", "mr", "gu", "pa"}

COMMON_ENGLISH_WORDS = {
    "a", "about", "alert", "also", "and", "any", "appears", "area", "are", "at",
    "available", "before", "brief", "carefully", "cctv", "check", "checked", "collecting",
    "complaint", "developments", "detain", "did", "evidence", "few", "footage", "for",
    "from", "gather", "good", "he", "hours", "i", "if", "immediately", "inform",
    "is", "it", "keep", "kind", "late", "local", "market", "more", "multiple", "nearby",
    "night", "no", "not", "now", "of", "okay", "patrol", "person", "please", "questioning",
    "records", "reported", "rounds", "same", "says", "should", "sir", "stay", "suspicious",
    "surroundings", "surveillance", "team", "thank", "that", "the", "there", "times", "to",
    "understood", "units", "updated", "verify", "visited", "was", "we", "were", "what",
    "will", "work", "you", "yes",
}


SARVAM_API_URL = "https://api.sarvam.ai/speech-to-text"
MAX_CHUNK_SECONDS = 25  # Sarvam limit is 30s, use 25s for safety


class SarvamTranscriber:
    def __init__(self, api_key: str):
        self.api_key = api_key
        print(f"Sarvam AI initialized — Regional language engine ready")

    def supports_language(self, language_code: str) -> bool:
        return language_code == "auto" or language_code in SARVAM_LANGUAGE_MAP

    def _read_wav(self, path: str):
        """Read WAV file and return (samples_float32, sample_rate)."""
        with wave.open(path, "rb") as wf:
            n_channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            frame_rate = wf.getframerate()
            raw = wf.readframes(wf.getnframes())

        if sample_width == 2:
            samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        elif sample_width == 1:
            samples = np.frombuffer(raw, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0
        else:
            samples = np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0

        if n_channels > 1:
            samples = samples.reshape(-1, n_channels)[:, 0]

        return samples, frame_rate

    def _write_wav_bytes(self, samples: np.ndarray, sample_rate: int) -> bytes:
        """Convert float32 samples to 16-bit PCM WAV bytes."""
        buf = io.BytesIO()
        int_samples = np.clip(samples, -1.0, 1.0)
        int_samples = (int_samples * 32767).astype(np.int16)
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(int_samples.tobytes())
        return buf.getvalue()

    def _english_signal(self, text: str) -> dict:
        """Measure how strongly a transcript looks like real English text."""
        tokens = re.findall(r"[a-z']+", text.lower())
        ascii_letters = sum(1 for c in text if c.isascii() and c.isalpha())
        alpha_chars = sum(1 for c in text if c.isalpha())
        ascii_ratio = ascii_letters / max(alpha_chars, 1)
        common_hits = sum(1 for token in tokens if token in COMMON_ENGLISH_WORDS)
        common_ratio = common_hits / max(len(tokens), 1)
        return {
            "ascii_ratio": ascii_ratio,
            "common_hits": common_hits,
            "common_ratio": common_ratio,
        }

    def _should_use_english_fallback(self, auto_text: str, english_text: str) -> bool:
        """Prefer explicit English only when it clearly looks better than auto-detect."""
        if not english_text:
            return False

        auto_signal = self._english_signal(auto_text)
        english_signal = self._english_signal(english_text)

        return (
            english_signal["ascii_ratio"] >= 0.85
            and english_signal["common_hits"] >= 3
            and english_signal["common_ratio"] >= 0.15
            and (
                english_signal["common_hits"] >= auto_signal["common_hits"] + 3
                or english_signal["ascii_ratio"] >= auto_signal["ascii_ratio"] + 0.35
            )
        )

    def _split_text_for_translation(self, text: str, max_chars: int = 900) -> list:
        """Split text into chunks ≤ max_chars, breaking at sentence boundaries."""
        if len(text) <= max_chars:
            return [text]
        chunks = []
        # Split on common sentence-ending punctuation (including Devanagari danda)
        import re
        sentences = re.split(r'(?<=[.।?!\n])\s*', text)
        current = ""
        for sentence in sentences:
            if not sentence:
                continue
            if len(current) + len(sentence) + 1 <= max_chars:
                current = (current + " " + sentence).strip()
            else:
                if current:
                    chunks.append(current)
                # If a single sentence is too long, split by words
                if len(sentence) > max_chars:
                    words = sentence.split()
                    current = ""
                    for word in words:
                        if len(current) + len(word) + 1 <= max_chars:
                            current = (current + " " + word).strip()
                        else:
                            if current:
                                chunks.append(current)
                            current = word
                else:
                    current = sentence
        if current:
            chunks.append(current)
        return chunks

    def _split_into_chunks(self, samples: np.ndarray, sample_rate: int):
        """Split audio samples into MAX_CHUNK_SECONDS sized chunks."""
        chunk_size = MAX_CHUNK_SECONDS * sample_rate
        chunks = []
        for i in range(0, len(samples), chunk_size):
            chunk = samples[i:i + chunk_size]
            if len(chunk) > 0:
                chunks.append(chunk)
        return chunks

    def _transcribe_chunk(self, wav_bytes: bytes, sarvam_lang: str, with_punctuation: bool = False) -> dict:
        """Send one audio chunk to Sarvam API and return transcript text + detected language."""
        payload = {
            "language_code": sarvam_lang,
            "model": "saarika:v2.5",
            "with_timestamps": "false",
            "with_punctuation": "true" if with_punctuation else "false",
        }
        response = requests.post(
            SARVAM_API_URL,
            headers={"api-subscription-key": self.api_key},
            files={"file": ("chunk.wav", wav_bytes, "audio/wav")},
            data=payload,
            timeout=60,
        )

        if response.status_code != 200:
            raise Exception(f"Sarvam API error {response.status_code}: {response.text[:200]}")

        data = response.json()
        return {
            "transcript": data.get("transcript", "").strip(),
            "language_code": data.get("language_code"),
            "language_probability": data.get("language_probability"),
        }

    def transcribe(self, audio_path: str, language: str) -> dict:
        """
        Transcribe audio using Sarvam AI API.
        Automatically splits audio > 25s into chunks.
        language="auto" uses Sarvam's auto-detect (language_code="unknown").
        """
        start_time = time.time()
        is_auto = (language == "auto")

        if is_auto:
            sarvam_lang = "unknown"
        else:
            sarvam_lang = SARVAM_LANGUAGE_MAP.get(language)
            if not sarvam_lang:
                raise ValueError(f"Language '{language}' not supported by Sarvam AI")

        print(f"  [Sarvam AI] Transcribing in {'auto-detect' if is_auto else sarvam_lang}...")

        try:
            samples, sample_rate = self._read_wav(audio_path)
            duration = len(samples) / sample_rate
            print(f"  [Sarvam AI] Audio duration: {duration:.1f}s")

            # Split into chunks if longer than limit
            chunks = self._split_into_chunks(samples, sample_rate)
            print(f"  [Sarvam AI] Processing {len(chunks)} chunk(s)...")

            # Enable punctuation for all languages including auto-detect
            punctuate = True

            all_text_parts = []
            detected_lang_code = None
            detected_lang_prob = None
            effective_auto_lang = sarvam_lang
            for i, chunk in enumerate(chunks):
                wav_bytes = self._write_wav_bytes(chunk, sample_rate)
                print(f"  [Sarvam AI] Chunk {i+1}/{len(chunks)} ({len(chunk)/sample_rate:.1f}s)...")

                chunk_lang = effective_auto_lang if is_auto else sarvam_lang
                result = self._transcribe_chunk(wav_bytes, chunk_lang, with_punctuation=punctuate)

                if i == 0 and is_auto and result.get("language_code"):
                    detected_lang_code = result["language_code"]
                    detected_lang_prob = result.get("language_probability")
                    print(f"  [Sarvam AI] Auto-detected: {detected_lang_code} (confidence: {detected_lang_prob})")

                    if detected_lang_code != SARVAM_LANGUAGE_MAP["en"]:
                        english_result = self._transcribe_chunk(
                            wav_bytes,
                            SARVAM_LANGUAGE_MAP["en"],
                            with_punctuation=punctuate,
                        )
                        if self._should_use_english_fallback(result["transcript"], english_result["transcript"]):
                            print("  [Sarvam AI] Auto-detect fallback: using en-IN because the first chunk looks clearly English")
                            result = english_result
                            detected_lang_code = SARVAM_LANGUAGE_MAP["en"]
                            detected_lang_prob = None
                            effective_auto_lang = SARVAM_LANGUAGE_MAP["en"]

                if result["transcript"]:
                    all_text_parts.append(result["transcript"])

            transcript = " ".join(all_text_parts).strip()
            if not transcript:
                transcript = "(No speech detected)"

            # Resolve the actual language code from detection
            if is_auto and detected_lang_code:
                # Reverse lookup: "hi-IN" -> "hi"
                resolved_language = self._bcp47_to_short(detected_lang_code)
            else:
                resolved_language = language

            processing_time = round(time.time() - start_time, 2)
            print(f"  [Sarvam AI] Done in {processing_time}s: '{transcript[:80]}'")

            segments = [{
                "id": int(time.time() * 1000),
                "start": 0.0,
                "end": round(duration, 2),
                "text": transcript,
            }]

            return {
                "text": transcript,
                "segments": segments,
                "language": resolved_language,
                "language_name": self._get_language_name(resolved_language),
                "detected_language": detected_lang_code if is_auto else None,
                "detection_confidence": detected_lang_prob if is_auto else None,
                "task": "transcribe",
                "processing_time": processing_time,
                "engine": "sarvam",
            }

        except requests.exceptions.Timeout:
            raise Exception("Sarvam AI request timed out. Please check your internet connection.")
        except requests.exceptions.ConnectionError:
            raise Exception("Cannot connect to Sarvam AI. Please check your internet connection.")

    def translate(self, audio_path: str, language: str, target_language: str = "en") -> dict:
        """
        Two-step pipeline: Sarvam STT → Sarvam Translate → target language text.
        Supports auto-detect for source language.
        """
        start_time = time.time()

        # Step 1: Transcribe speech to text (auto-detect if language="auto")
        print(f"  [Sarvam] Step 1: Transcribing {'auto-detect' if language == 'auto' else language} speech...")
        stt_result = self.transcribe(audio_path, language)
        source_text = stt_result["text"]
        resolved_source = stt_result["language"]  # actual detected language if auto

        if source_text == "(No speech detected)" or not source_text.strip():
            return {
                "text": "(No speech detected)",
                "original_text": "",
                "segments": [],
                "language": resolved_source,
                "language_name": self._get_language_name(resolved_source),
                "detected_language": stt_result.get("detected_language"),
                "detection_confidence": stt_result.get("detection_confidence"),
                "target_language": target_language,
                "target_language_name": self._get_language_name(target_language),
                "task": "translate",
                "processing_time": round(time.time() - start_time, 2),
                "engine": "sarvam",
            }

        # Skip translation if source == target
        if resolved_source == target_language:
            print(f"  [Sarvam] Source and target are the same ({resolved_source}), skipping translation.")
            return {
                "text": source_text,
                "original_text": source_text,
                "segments": stt_result["segments"],
                "language": resolved_source,
                "language_name": self._get_language_name(resolved_source),
                "detected_language": stt_result.get("detected_language"),
                "detection_confidence": stt_result.get("detection_confidence"),
                "target_language": target_language,
                "target_language_name": self._get_language_name(target_language),
                "task": "translate",
                "processing_time": round(time.time() - start_time, 2),
                "engine": "sarvam",
            }

        source_bcp47 = SARVAM_LANGUAGE_MAP.get(resolved_source)
        target_bcp47 = SARVAM_LANGUAGE_MAP.get(target_language)
        if not source_bcp47:
            raise ValueError(f"Source language '{resolved_source}' not supported for translation")
        if not target_bcp47:
            raise ValueError(f"Target language '{target_language}' not supported for translation")

        print(f"  [Translate] Step 2: {resolved_source} → {target_language}: '{source_text[:60]}'...")

        # Step 2: Translate — try IndicTrans2 first (better numeral normalisation for Indic langs),
        # fall back to Sarvam mayura:v1 if IndicTrans2 is unavailable.
        translated_text = None
        try:
            from . import indictrans_translator as it2
            if it2.is_supported(resolved_source, target_language):
                print(f"  [IndicTrans2] Translating {resolved_source} → {target_language}...")
                translated_text = it2.translate(source_text, resolved_source, target_language)
                print(f"  [IndicTrans2] Done: '{translated_text[:80]}'")
        except Exception as it2_err:
            print(f"  [IndicTrans2] Unavailable ({it2_err}) — falling back to Sarvam translate")

        if not translated_text:
            text_chunks = self._split_text_for_translation(source_text, max_chars=900)
            print(f"  [Sarvam] Translating {len(text_chunks)} chunk(s) ({len(source_text)} chars total)...")
            translated_parts = []
            for i, chunk in enumerate(text_chunks):
                print(f"  [Sarvam] Translate chunk {i+1}/{len(text_chunks)} ({len(chunk)} chars)...")
                response = requests.post(
                    "https://api.sarvam.ai/translate",
                    headers={
                        "api-subscription-key": self.api_key,
                        "Content-Type": "application/json",
                    },
                    json={
                        "input": chunk,
                        "source_language_code": source_bcp47,
                        "target_language_code": target_bcp47,
                        "speaker_gender": "Male",
                        "mode": "formal",
                        "model": "mayura:v1",
                        "enable_preprocessing": True,
                    },
                    timeout=30,
                )
                if response.status_code != 200:
                    raise Exception(f"Sarvam Translate error {response.status_code}: {response.text[:200]}")
                part = response.json().get("translated_text", "").strip()
                if not part:
                    raise Exception(f"Sarvam Translate returned empty response for chunk {i+1}")
                translated_parts.append(part)
            translated_text = " ".join(translated_parts)

        print(f"  [Translate] Done: '{translated_text[:80]}'")

        processing_time = round(time.time() - start_time, 2)
        segments = [{
            "id": int(time.time() * 1000),
            "start": 0.0,
            "end": processing_time,
            "text": translated_text,
        }]

        return {
            "text": translated_text,
            "original_text": source_text,
            "segments": segments,
            "language": resolved_source,
            "language_name": self._get_language_name(resolved_source),
            "detected_language": stt_result.get("detected_language"),
            "detection_confidence": stt_result.get("detection_confidence"),
            "target_language": target_language,
            "target_language_name": self._get_language_name(target_language),
            "task": "translate",
            "processing_time": processing_time,
            "engine": "sarvam",
        }

    def _bcp47_to_short(self, bcp47_code: str) -> str:
        """Reverse lookup: 'hi-IN' -> 'hi', 'od-IN' -> 'or'."""
        reverse_map = {v: k for k, v in SARVAM_LANGUAGE_MAP.items()}
        return reverse_map.get(bcp47_code, bcp47_code.split("-")[0])

    def _get_language_name(self, code: str) -> str:
        names = {
            "en": "English", "hi": "Hindi", "te": "Telugu", "ta": "Tamil", "bn": "Bengali",
            "kn": "Kannada", "ml": "Malayalam", "mr": "Marathi", "gu": "Gujarati",
            "pa": "Punjabi", "or": "Odia", "ur": "Urdu", "as": "Assamese",
        }
        return names.get(code, f"Language ({code})")
