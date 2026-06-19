from app.database import SessionLocal
from app.models import PageContent
from app.services.ai_subdoc_detection import detect_subdocuments

db = SessionLocal()

# Get pages 1-6 for doc 29
pages = db.query(PageContent).filter(PageContent.document_id == 29).order_by(PageContent.page_number).all()
page_texts = [(p.page_number, p.page_text) for p in pages]

print(f"Testing subdoc detection on {len(page_texts)} pages\n")

# Run detection
result = detect_subdocuments(page_texts)

print(f"Detected {len(result)} subdocuments:\n")
for i, doc in enumerate(result, 1):
    print(f"{i}. {doc.get('title')}")
    print(f"   Type: {doc.get('document_type')}")
    print(f"   Pages: {doc.get('start_page')}-{doc.get('end_page')}")
    print(f"   Confidence: {doc.get('confidence')}\n")

# Also show what Ollama raw response was
print("\n=== ANALYZING PAGE BOUNDARIES ===\n")
for pn, txt in page_texts:
    first_line = txt.split('\n')[0][:100]
    print(f"Page {pn} starts with: {first_line}")

db.close()
