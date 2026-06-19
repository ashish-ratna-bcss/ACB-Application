from app.database import SessionLocal
from app.models import PageContent
import json
import os
import ollama

from app.config import AI_BATCH_MAX_PAGES, AI_BATCH_MAX_WORDS, OLLAMA_CHAT_MODEL, OLLAMA_TIMEOUT, OLLAMA_URL
from app.services.ai_subdoc_detection import _DETECTION_PROMPT, _build_batches

db = SessionLocal()

# Get pages 1-6 for doc 29
pages = db.query(PageContent).filter(PageContent.document_id == 29).order_by(PageContent.page_number).all()
page_texts = [(p.page_number, p.page_text) for p in pages]

batches = _build_batches(page_texts)
batch = batches[0]  # Only one batch for doc 29

page_block = "\n\n".join(f"[PAGE {pn}]\n{txt}" for pn, txt in batch)

# Call Ollama
ollama_url = os.getenv("OLLAMA_URL", OLLAMA_URL)
model = os.getenv("OLLAMA_CHAT_MODEL", OLLAMA_CHAT_MODEL)
timeout_str = os.getenv("OLLAMA_TIMEOUT", str(OLLAMA_TIMEOUT) if OLLAMA_TIMEOUT else "None")
timeout = int(timeout_str) if timeout_str and timeout_str != "None" else None

client = ollama.Client(host=ollama_url, timeout=timeout)
response = client.chat(
    model=model,
    messages=[
        {"role": "system", "content": _DETECTION_PROMPT},
        {"role": "user", "content": page_block},
    ],
    format="json",
    options={"temperature": 0},
)

raw = response.message.content or "{}"
print("RAW OLLAMA RESPONSE:")
print(raw)
print("\n\nPARSED:")
data = json.loads(raw)
print(json.dumps(data, indent=2))

db.close()
