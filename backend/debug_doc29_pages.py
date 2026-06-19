from app.database import SessionLocal
from app.models import PageContent

db = SessionLocal()

# Get pages 1-6 for doc 29
pages = db.query(PageContent).filter(PageContent.document_id == 29).order_by(PageContent.page_number).all()

for p in pages:
    print(f"\n{'='*80}")
    print(f"PAGE {p.page_number}")
    print(f"{'='*80}\n")
    print(p.page_text[:1500])
    print(f"\n... (total {len(p.page_text)} chars)\n")

db.close()
