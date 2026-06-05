from app.database import SessionLocal
from app.models import Document, PipelineStageRun, SubDocument
from app.services.pipeline import run_pipeline

db = SessionLocal()

# Get doc 29
doc = db.query(Document).filter(Document.id == 29).first()
if not doc:
    print("Doc 29 not found")
    exit()

# Extract values before closing session
doc_id = doc.id
case_id = doc.case_id
file_name = doc.file_name

print(f"Rerunning pipeline for doc {doc_id}: {file_name}")

# Clear stage runs to force full rerun
db.query(PipelineStageRun).filter(PipelineStageRun.document_id == 29).delete()
db.commit()

db.close()

# Run pipeline from start
run_pipeline(doc_id, case_id, file_name, start_stage=None)

print("\nPipeline complete. Checking results...")

db = SessionLocal()

subdocs = db.query(SubDocument).filter(SubDocument.document_id == 29).order_by(SubDocument.start_page).all()
print(f"\nDetected {len(subdocs)} subdocuments:")
for i, sd in enumerate(subdocs, 1):
    print(f"  {i}. {sd.title} (pages {sd.start_page}-{sd.end_page})")

db.close()
