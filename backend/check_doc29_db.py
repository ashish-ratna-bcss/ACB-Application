from app.database import SessionLocal
from app.models import SubDocument, SubDocumentContent, SubDocumentDetection

db = SessionLocal()

print("=== SubDocumentDetection (checkpoint) ===")
detections = db.query(SubDocumentDetection).filter(SubDocumentDetection.document_id == 29).order_by(SubDocumentDetection.start_page).all()
print(f"Count: {len(detections)}\n")
for d in detections:
    print(f"Pages {d.start_page}-{d.end_page}: {d.title} ({d.document_type})")

print("\n=== SubDocument (stored) ===")
subdocs = db.query(SubDocument).filter(SubDocument.document_id == 29).order_by(SubDocument.start_page).all()
print(f"Count: {len(subdocs)}\n")
for sd in subdocs:
    content = db.query(SubDocumentContent).filter(SubDocumentContent.sub_document_id == sd.id).first()
    print(f"Pages {sd.start_page}-{sd.end_page}: {sd.title}")
    if content:
        print(f"  Subject: {(content.subject or '')[:80]}")

db.close()
