from app.database import SessionLocal
from app.models import (
    Document, PageContent, OCRBlock, SubDocument, SubDocumentContent,
    PipelineStageRun, SubDocumentDetection, ExtractedContent
)

db = SessionLocal()

doc_id = 29

# Delete all related data
db.query(SubDocumentContent).filter(
    SubDocumentContent.sub_document_id.in_(
        db.query(SubDocument.id).filter(SubDocument.document_id == doc_id)
    )
).delete(synchronize_session=False)
db.query(SubDocument).filter(SubDocument.document_id == doc_id).delete()
db.query(ExtractedContent).filter(ExtractedContent.document_id == doc_id).delete()
db.query(SubDocumentDetection).filter(SubDocumentDetection.document_id == doc_id).delete()
db.query(PipelineStageRun).filter(PipelineStageRun.document_id == doc_id).delete()
db.query(PageContent).filter(PageContent.document_id == doc_id).delete()
db.query(OCRBlock).filter(OCRBlock.document_id == doc_id).delete()

# Reset document status
doc = db.query(Document).filter(Document.id == doc_id).first()
if doc:
    doc.status = "uploaded"
    doc.current_stage = None
    doc.error_message = None

db.commit()
print(f"Cleaned up doc {doc_id}")

db.close()
