"""
Transcriber - Sarvam AI powered Speech-to-Text.
All languages (including English) use Sarvam AI cloud API.
"""

import os
import time
from pathlib import Path
from dotenv import load_dotenv
from .sarvam_transcriber import SarvamTranscriber, SARVAM_LANGUAGE_MAP

# Load API keys from .env
BACKEND_ENV = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(BACKEND_ENV)
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")


class VoskTranscriber:
    def __init__(self, model_dir=None):
        if not SARVAM_API_KEY:
            raise RuntimeError("SARVAM_API_KEY not found in .env")

        self.sarvam = SarvamTranscriber(SARVAM_API_KEY)
        print(f"[Transcriber] Sarvam AI engine ready for: {list(SARVAM_LANGUAGE_MAP.keys())}")

    def is_model_loaded(self):
        return True

    def transcribe(self, audio_path, language="en", task="transcribe", target_language="en"):
        print(f"[Transcriber] Lang={language}, Task={task}, Target={target_language}")

        if language != "auto" and not self.sarvam.supports_language(language):
            raise ValueError(f"Language '{language}' is not supported.")

        if task == "translate":
            print(f"[Transcriber] -> Sarvam AI STT + Translate ({language} -> {target_language})")
            return self.sarvam.translate(audio_path, language, target_language)
        else:
            print(f"[Transcriber] -> Sarvam AI STT ({language})")
            return self.sarvam.transcribe(audio_path, language)

    def get_language_name(self, code):
        langs = {
            "en": "English", "hi": "Hindi", "te": "Telugu", "mr": "Marathi",
            "gu": "Gujarati", "ur": "Urdu", "ar": "Arabic", "ta": "Tamil",
            "kn": "Kannada", "ml": "Malayalam", "bn": "Bengali", "pa": "Punjabi",
            "as": "Assamese", "or": "Odia"
        }
        return langs.get(code, f"Language ({code})")

    def get_available_languages(self):
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

