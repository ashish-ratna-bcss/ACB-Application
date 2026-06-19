"""
LocalTranscriber — Self-hosted STT endpoint for investigation officers.

Endpoint: POST {LOCAL_STT_URL}
Auth:     X-API-Key header
Body:     multipart/form-data, field name "audio"
Optional form fields: language (default "auto"), diarize (default "true")

Response schema:
{
  "language": "te",
  "duration": 120.5,
  "raw": {
    "dialogue": [{"start": 0.0, "end": 2.5, "speaker": "Speaker_1", "text": "..."}]
  },
  "english": {
    "dialogue": [{"start": 0.0, "end": 2.5, "speaker": "Speaker_1", "text": "..."}]
  }
}
"""

import os
import time
from pathlib import Path
from dotenv import load_dotenv
import requests

BACKEND_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(BACKEND_ENV)

LOCAL_STT_URL = os.getenv("LOCAL_STT_URL", "http://124.123.14.2:8009/stt/transcribe")
STT_API_KEY = os.getenv("STT_API_KEY", "")

LANGUAGE_NAMES = {
    "en": "English", "hi": "Hindi", "te": "Telugu", "ta": "Tamil", "bn": "Bengali",
    "kn": "Kannada", "ml": "Malayalam", "mr": "Marathi", "gu": "Gujarati",
    "pa": "Punjabi", "or": "Odia", "ur": "Urdu", "as": "Assamese",
}


class LocalTranscriber:
    def __init__(self):
        if not LOCAL_STT_URL:
            raise RuntimeError("LOCAL_STT_URL not configured in .env")
        print(f"[LocalTranscriber] Self-hosted STT ready at {LOCAL_STT_URL}")

    def is_model_loaded(self):
        return True

    def supports_language(self, language_code: str) -> bool:
        return True

    def transcribe(self, audio_path: str, language: str = "auto", task: str = "transcribe", target_language: str = "en") -> dict:
        start_time = time.time()
        print(f"[LocalTranscriber] Sending {audio_path} → {LOCAL_STT_URL} (lang={language}, task={task})")

        headers = {}
        if STT_API_KEY:
            headers["X-API-Key"] = STT_API_KEY

        form_data = {
            "diarize": "true",
            "language": language if language != "auto" else "auto",
        }

        ext = Path(audio_path).suffix.lower()
        mime_map = {
            ".wav": "audio/wav", ".mp4": "video/mp4", ".mp3": "audio/mpeg",
            ".m4a": "audio/mp4", ".webm": "audio/webm", ".ogg": "audio/ogg",
            ".flac": "audio/flac", ".mov": "video/quicktime",
        }
        mime_type = mime_map.get(ext, "application/octet-stream")

        with open(audio_path, "rb") as f:
            response = requests.post(
                LOCAL_STT_URL,
                headers=headers,
                files={"audio": (Path(audio_path).name, f, mime_type)},
                data=form_data,
                timeout=180,
            )

        if response.status_code != 200:
            raise Exception(f"Local STT error {response.status_code}: {response.text[:300]}")

        data = response.json()
        detected_lang = data.get("language") or (language if language != "auto" else "en")
        duration = data.get("duration", 0.0)
        processing_time = round(time.time() - start_time, 2)

        # Build segments from raw dialogue (original language)
        raw_dialogue = data.get("raw", {}).get("dialogue", [])
        english_dialogue = data.get("english", {}).get("dialogue", [])

        def _dialogue_to_segments(dialogue: list, id_offset: int = 0) -> list:
            return [
                {
                    "id": id_offset + i,
                    "start": turn.get("start", 0.0),
                    "end": turn.get("end", 0.0),
                    "speaker": turn.get("speaker", f"Speaker_{i+1}"),
                    "text": turn.get("text", "").strip(),
                }
                for i, turn in enumerate(dialogue)
                if turn.get("text", "").strip()
            ]

        raw_segments = _dialogue_to_segments(raw_dialogue)
        english_segments = _dialogue_to_segments(english_dialogue)

        # Ollama cleanup layer — clean ONLY the raw (detected-language) turns, using the
        # English dialogue as meaning context. Falls back to uncorrected raw on any failure.
        try:
            from app.services.speech.transcript_corrector import correct_raw_segments
            raw_segments = correct_raw_segments(raw_segments, english_segments, detected_lang)
        except Exception as exc:
            print(f"[LocalTranscriber] Correction skipped: {exc}")

        # The raw and English dialogues use different diarization granularity
        # (e.g. 7 raw turns vs 16 English turns), so they cannot be merged 1:1.
        # Attach the time-overlapping counterpart text to each primary turn as
        # `original_text` so the UI can show both versions per diarization turn.
        def _attach_overlap(primary: list, secondary: list) -> None:
            for seg in primary:
                ps, pe = seg.get("start", 0.0), seg.get("end", 0.0)
                overlaps = [
                    o["text"] for o in secondary
                    if o.get("text") and o.get("start", 0.0) < pe and o.get("end", 0.0) > ps
                ]
                if overlaps:
                    seg["original_text"] = " ".join(overlaps)

        # Local endpoint always provides both raw + English.
        # transcribe → raw as primary, english as original (bonus translation shown alongside)
        # translate  → english as primary, raw as original
        if task == "translate" and english_dialogue:
            segments = english_segments
            original_segments = raw_segments
        else:
            segments = raw_segments
            original_segments = english_segments  # show free English translation alongside

        _attach_overlap(segments, original_segments)

        full_text = " ".join(s["text"] for s in segments) or "(No speech detected)"
        original_text = " ".join(s["text"] for s in original_segments) if original_segments else ""

        speakers = list(dict.fromkeys(s["speaker"] for s in segments))
        speaker_count = len(speakers)

        print(f"[LocalTranscriber] Done in {processing_time}s: {speaker_count} speakers, '{full_text[:80]}'")

        return {
            "text": full_text,
            "original_text": original_text,
            "segments": segments,
            "original_segments": original_segments,
            "language": detected_lang,
            "language_name": LANGUAGE_NAMES.get(detected_lang, detected_lang),
            "detected_language": detected_lang if language == "auto" else None,
            "detection_confidence": None,
            "target_language": target_language if task == "translate" else None,
            "target_language_name": LANGUAGE_NAMES.get(target_language) if task == "translate" else None,
            "task": task,
            "processing_time": processing_time,
            "speaker_count": speaker_count,
            "diarization": True,
            "engine": "local",
        }

    def get_language_name(self, code: str) -> str:
        return LANGUAGE_NAMES.get(code, f"Language ({code})")

    def get_available_languages(self) -> list:
        return [
            {"code": "en", "name": "English"},
            {"code": "te", "name": "Telugu"},
            {"code": "hi", "name": "Hindi"},
            {"code": "ta", "name": "Tamil"},
            {"code": "bn", "name": "Bengali"},
            {"code": "mr", "name": "Marathi"},
            {"code": "gu", "name": "Gujarati"},
            {"code": "kn", "name": "Kannada"},
            {"code": "or", "name": "Odia"},
            {"code": "ml", "name": "Malayalam"},
            {"code": "pa", "name": "Punjabi"},
        ]
