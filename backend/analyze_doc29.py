from app.database import SessionLocal
from app.models import Document, PageContent, SubDocument, SubDocumentDetection

db = SessionLocal()

# Get doc 29
doc = db.query(Document).filter(Document.id == 29).first()
if not doc:
    print("Doc 29 not found")
else:
    print(f"Doc 29: {doc.file_name}")
    print(f"Status: {doc.status}, Pages: {doc.total_pages}\n")

    # Get all pages
    pages = db.query(PageContent).filter(PageContent.document_id == 29).order_by(PageContent.page_number).all()
    print(f"Total pages in DB: {len(pages)}\n")

    # Show first 300 chars of each page to find boundaries
    for p in pages:
        first_300 = (p.page_text or "")[:300].replace("\n", " ")
        print(f"Page {p.page_number}: {first_300}...")

    # Get detected subdocs
    print("\n--- DETECTED SUBDOCUMENTS ---")
    subdocs = db.query(SubDocument).filter(SubDocument.document_id == 29).all()
    print(f"Count: {len(subdocs)}")
    for sd in subdocs:
        print(f"  {sd.title} (pages {sd.start_page}-{sd.end_page})")

    # Get checkpoint data
    print("\n--- CHECKPOINT DATA (SubDocumentDetection) ---")
    detections = db.query(SubDocumentDetection).filter(SubDocumentDetection.document_id == 29).all()
    print(f"Count: {len(detections)}")
    for d in detections:
        print(f"  {d.title} (pages {d.start_page}-{d.end_page})")

db.close()
