import os
from pathlib import Path

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
OLLAMA_CHAT_MODEL = "qwen2.5:14b-instruct-q4_K_M"
OLLAMA_EXTRACT_MODEL = "qwen2.5:14b-instruct-q4_K_M"
OLLAMA_DRAFT_MODEL = "qwen2.5:14b-instruct-q4_K_M"
OLLAMA_EMBED_MODEL = "nomic-embed-text"
OLLAMA_TIMEOUT = None                       # No timeout — allow Ollama unlimited time

# Qdrant
QDRANT_URL = "http://localhost:6333"
QDRANT_COLLECTION = "document_sections"
EMBEDDING_DIM = 768  # nomic-embed-text produces 768-dim vectors
