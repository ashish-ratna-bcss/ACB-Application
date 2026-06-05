from app.database import SessionLocal
from app.models import PageContent
from app.services.ai_subdoc_detection import detect_subdocuments

db = SessionLocal()

# Get ONLY doc 29 pages
pages = db.query(PageContent).filter(PageContent.document_id == 29).order_by(PageContent.page_number).all()
page_texts = [(p.page_number, p.page_text) for p in pages]

print(f"Testing detection on doc 29: {len(page_texts)} pages\n")

result = detect_subdocuments(page_texts)

print(f"Detected {len(result)} subdocuments:\n")
for i, doc in enumerate(result, 1):
    print(f"{i}. {doc.get('title')}")
    print(f"   Type: {doc.get('document_type')}")
    print(f"   Pages: {doc.get('start_page')}-{doc.get('end_page')}")
    print(f"   Ref: {doc.get('reference_number')}")
    print()

db.close()
