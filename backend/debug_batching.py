from app.database import SessionLocal
from app.models import PageContent
from app.services.ai_subdoc_detection import _build_batches

db = SessionLocal()

# Get pages 1-6 for doc 29
pages = db.query(PageContent).filter(PageContent.document_id == 29).order_by(PageContent.page_number).all()
page_texts = [(p.page_number, p.page_text) for p in pages]

batches = _build_batches(page_texts)

print(f"Total pages: {len(page_texts)}")
print(f"Batches created: {len(batches)}\n")

for i, batch in enumerate(batches, 1):
    print(f"Batch {i}: pages {[p[0] for p in batch]}")
    total_words = sum(len(p[1].split()) for p in batch)
    print(f"  Total words: {total_words}")
    print()

db.close()
