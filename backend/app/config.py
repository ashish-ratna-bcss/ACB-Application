import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
PDF_UPLOAD_DIR = BASE_DIR / "pdf-files"
PDF_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


DATABASE_URL = f"sqlite:///{BASE_DIR / 'acb_documents.db'}"

MAX_FILE_SIZE_MB = 300
ALLOWED_CONTENT_TYPE = "application/pdf"

POPPLER_PATH = os.getenv("POPPLER_PATH", r"C:\Poppler\Release-26.02.0-0\poppler-26.02.0\Library\bin" if os.name == "nt" else "")

if POPPLER_PATH and POPPLER_PATH not in os.environ.get("PATH", ""):
    os.environ["PATH"] = POPPLER_PATH + os.pathsep + os.environ.get("PATH", "")

# Batch limits for AI section detection
AI_BATCH_MAX_PAGES = 3
AI_BATCH_MAX_WORDS = 3000

# Ollama
OLLAMA_URL = "http://32.192.131.130:11434"
OLLAMA_CHAT_MODEL = "qwen2.5:7b-instruct-q4_K_M"
OLLAMA_EXTRACT_MODEL = "qwen2.5:7b-instruct-q4_K_M"
OLLAMA_DRAFT_MODEL = "qwen2.5:7b-instruct-q4_K_M"
OLLAMA_EMBED_MODEL = "nomic-embed-text"
OLLAMA_TIMEOUT = None                       # No timeout — allow Ollama unlimited time

# Qdrant
QDRANT_URL = os.getenv("QDRANT_URL", "http://acb-qdrant:6333")
QDRANT_COLLECTION = "document_sections"
EMBEDDING_DIM = 768  # nomic-embed-text produces 768-dim vectors

# Remote OCR Service
SPEECH_INTEL_BASE_URL = os.getenv("SPEECH_INTEL_BASE_URL", "http://98.86.63.69")
SPEECH_INTEL_API_KEY = os.getenv("SPEECH_INTEL_API_KEY", "f379241418da1092837aaa6b7138e850e4b99b1b2f88ba90d527e6a0b4b4a600")

# Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6IghokLuVw1ejjiBcGe5yZTPh-ptgPP4x-e27t8iWI88Q")

# Mistral API
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "soDFsm8v6ryWtZosoIxAtrS5LBy1Kh5n")

