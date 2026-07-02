import json
import logging
import re
import uuid
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

import aiofiles
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.config import ALLOWED_CONTENT_TYPE, MAX_FILE_SIZE_MB, PDF_UPLOAD_DIR
from app.database import SessionLocal
from app.models import Document, SubDocument, SubDocumentContent
from app.services.pipeline import (
    STAGES_LIST, run_pipeline, _clear_downstream_data, _mark_stage_completed
)

router = APIRouter(prefix="/pdf", tags=["PDF"])

_CASE_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


# ── Upload ───────────────────────────────────────────────────────────────────

@router.post("/upload", summary="Upload a PDF and start processing pipeline")
async def upload_pdf(
    background_tasks: BackgroundTasks,
    case_id: str = Form(..., alias="caseId"),
    phase: str = Form(default=None),
    file: UploadFile = File(...),
):
    case_id = case_id.strip()
    if not case_id or not _CASE_ID_RE.match(case_id):
        raise HTTPException(status_code=400, detail="Invalid caseId. Only alphanumeric, hyphens, underscores allowed.")

    if file.content_type != ALLOWED_CONTENT_TYPE:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Only PDF accepted.")

    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(status_code=413, detail=f"File too large ({size_mb:.1f} MB). Max {MAX_FILE_SIZE_MB} MB.")

    if not contents.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="File does not appear to be a valid PDF.")

    case_dir = PDF_UPLOAD_DIR / case_id
    case_dir.mkdir(parents=True, exist_ok=True)

    original_stem = Path(file.filename or "document").stem
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_id = uuid.uuid4().hex[:8]
    safe_name = f"{original_stem}_{timestamp}_{unique_id}.pdf"
    dest_path = case_dir / safe_name

    async with aiofiles.open(dest_path, "wb") as out:
        await out.write(contents)

    db: Session = SessionLocal()
    try:
        doc = Document(
            case_id=case_id,
            file_name=safe_name,
            original_name=file.filename,
            file_path=str(dest_path),
            status="uploaded",
            phase=phase,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        document_id = doc.id
    finally:
        db.close()

    background_tasks.add_task(run_pipeline, document_id, case_id, safe_name)

    return JSONResponse(
        status_code=201,
        content={
            "message": "PDF uploaded. Processing pipeline started.",
            "document_id": document_id,
            "case_id": case_id,
            "file_name": safe_name,
            "original_name": file.filename,
            "phase": phase,
            "size_bytes": len(contents),
            "size_mb": round(size_mb, 3),
            "status": "uploaded",
        },
    )


# ── Rerun stage ──────────────────────────────────────────────────────────────

@router.post("/rerun/{document_id}", summary="Rerun pipeline from a specific stage")
def rerun_stage(
    document_id: int,
    background_tasks: BackgroundTasks,
    start_stage: str = Query(..., description="Stage to start from (e.g., detecting_subdocuments)"),
):
    if start_stage not in STAGES_LIST:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid start_stage. Must be one of: {', '.join(STAGES_LIST)}"
        )

    db: Session = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        case_id = doc.case_id
        file_name = doc.file_name

        # Clear downstream data (stage start_stage+1 onwards)
        _clear_downstream_data(db, document_id, start_stage)

        # Reset document status
        doc.status = "processing"
        doc.current_stage = start_stage
        doc.error_message = None
        db.commit()

        # Queue pipeline rerun
        background_tasks.add_task(run_pipeline, document_id, case_id, file_name, start_stage)

        return JSONResponse(
            status_code=202,
            content={
                "message": f"Pipeline rerun queued from stage '{start_stage}'",
                "document_id": document_id,
                "case_id": case_id,
                "start_stage": start_stage,
                "status": "queued",
            },
        )
    finally:
        db.close()


# ── Status ───────────────────────────────────────────────────────────────────

@router.get("/status/{document_id}", summary="Get document processing status")
def get_status(document_id: int):
    from app.services.progress_store import get_all_progress
    db: Session = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        return {
            "document_id": doc.id,
            "case_id": doc.case_id,
            "file_name": doc.file_name,
            "status": doc.status,
            "current_stage": doc.current_stage,
            "total_pages": doc.total_pages,
            "error_message": doc.error_message,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "stage_progress": get_all_progress(document_id),
        }
    finally:
        db.close()


# ── Sub-documents ─────────────────────────────────────────────────────────────

@router.get("/subdocuments/{document_id}", summary="Get sub-documents extracted from a document")
def get_subdocuments(document_id: int):
    db: Session = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        subdocs = (
            db.query(SubDocument)
            .filter(SubDocument.document_id == document_id)
            .order_by(SubDocument.start_page)
            .all()
        )

        result = []
        for sd in subdocs:
            content = (
                db.query(SubDocumentContent)
                .filter(SubDocumentContent.sub_document_id == sd.id)
                .first()
            )
            result.append({
                "id": sd.id,
                "title": sd.title,
                "document_type": sd.document_type,
                "start_page": sd.start_page,
                "end_page": sd.end_page,
                "confidence_score": sd.confidence_score,
                "content": {
                    "subject": content.subject if content else None,
                    "purpose": content.purpose if content else None,
                    "summary": content.summary if content else None,
                    "main_content": (content.main_content or "")[:500] if content else None,
                    "key_persons": json.loads(content.key_persons or "[]") if content else [],
                    "key_dates": json.loads(content.key_dates or "[]") if content else [],
                    "key_findings": json.loads(content.key_findings or "[]") if content else [],
                    "key_actions": json.loads(content.key_actions or "[]") if content else [],
                    "organizations": json.loads(content.organizations or "[]") if content else [],
                } if content else None,
            })

        return {
            "document_id": document_id,
            "case_id": doc.case_id,
            "status": doc.status,
            "total_pages": doc.total_pages,
            "subdocument_count": len(result),
            "subdocuments": result,
        }
    finally:
        db.close()


# ── Logs ──────────────────────────────────────────────────────────────────────

@router.get("/logs/{document_id}", summary="Get processing logs for a document")
def get_document_logs(document_id: int):
    from app.services.log_store import get_logs
    return {"document_id": document_id, "logs": get_logs(document_id)}


# ── Page-wise Text ────────────────────────────────────────────────────────────

@router.get("/pages/{document_id}", summary="Get page-wise text for a document")
def get_document_pages(document_id: int):
    from app.models import PageContent
    db: Session = SessionLocal()
    try:
        pages = db.query(PageContent).filter(PageContent.document_id == document_id).order_by(PageContent.page_number).all()
        return {
            "document_id": document_id,
            "pages": [{"page_number": p.page_number, "page_text": p.page_text} for p in pages]
        }
    finally:
        db.close()


# ── Document Content (Pages + Subdocuments) ──────────────────────────────────

@router.get("/document/{case_id}/{document_id_or_name}", summary="Get extracted content (pages + subdocuments) for a document")
def get_document_content(case_id: str, document_id_or_name: str):
    from app.models import PageContent
    db: Session = SessionLocal()
    try:
        doc = None
        try:
            doc_id = int(document_id_or_name)
            doc = db.query(Document).filter(Document.id == doc_id, Document.case_id == case_id).first()
        except ValueError:
            doc = db.query(Document).filter(Document.file_name == document_id_or_name, Document.case_id == case_id).first()

        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        pages = db.query(PageContent).filter(PageContent.document_id == doc.id).order_by(PageContent.page_number).all()

        subdocs = db.query(SubDocument).filter(SubDocument.document_id == doc.id).order_by(SubDocument.start_page).all()
        subdoc_list = []
        for sd in subdocs:
            content = db.query(SubDocumentContent).filter(SubDocumentContent.sub_document_id == sd.id).first()
            subdoc_list.append({
                "id": sd.id,
                "title": sd.title,
                "document_type": sd.document_type,
                "start_page": sd.start_page,
                "end_page": sd.end_page,
                "confidence_score": sd.confidence_score,
                "content": {
                    "subject": content.subject if content else None,
                    "summary": content.summary if content else None,
                } if content else None,
            })

        return {
            "document_id": doc.id,
            "case_id": case_id,
            "file_name": doc.file_name,
            "status": doc.status,
            "total_pages": doc.total_pages,
            "pages": [{"page_number": p.page_number, "page_text": p.page_text} for p in pages],
            "subdocuments": subdoc_list,
        }
    finally:
        db.close()


class SavePagesRequest(BaseModel):
    pages: list[dict]  # [{"page_number": int, "page_text": str}]

@router.post("/save-to-case/{document_id}", summary="Save edited text to case as evidence")
def save_pages_to_case(document_id: int, req: SavePagesRequest):
    from app.models import PageContent, EvidenceItem
    import uuid
    db: Session = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        # Update page content
        for p in req.pages:
            db.query(PageContent).filter(
                PageContent.document_id == document_id,
                PageContent.page_number == p.get("page_number")
            ).update({"page_text": p.get("page_text")})

        # Add as evidence if not exists
        title = doc.original_name or doc.file_name
        existing = db.query(EvidenceItem).filter(
            EvidenceItem.case_id == doc.case_id,
            EvidenceItem.title == title
        ).first()

        if not existing:
            item = EvidenceItem(
                id=str(uuid.uuid4()),
                case_id=doc.case_id,
                evidence_type="document",
                title=title,
                description="Document processed and verified via AI Processor",
                status="logged"
            )
            db.add(item)

        db.commit()
        return {"status": "ok", "message": "Successfully saved to case"}
    finally:
        db.close()


# ── List ─────────────────────────────────────────────────────────────────────

@router.get("/list", summary="List all uploaded documents")
def list_pdfs():
    db: Session = SessionLocal()
    try:
        docs = db.query(Document).order_by(Document.created_at.desc()).all()
        return {
            "count": len(docs),
            "documents": [
                {
                    "document_id": d.id,
                    "case_id": d.case_id,
                    "file_name": d.file_name,
                    "original_name": d.original_name,
                    "status": d.status,
                    "total_pages": d.total_pages,
                    "phase": d.phase,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in docs
            ],
        }
    finally:
        db.close()


# ── Reindex embeddings ────────────────────────────────────────────────────────

@router.post("/reindex/{case_id}", summary="Re-generate Qdrant embeddings from existing DB content")
def reindex_case(case_id: str):
    import os
    import uuid as _uuid
    try:
        import ollama
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, PointStruct, VectorParams
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Missing dependency: {e}")

    from app.config import EMBEDDING_DIM, OLLAMA_EMBED_MODEL, OLLAMA_URL, QDRANT_COLLECTION, QDRANT_URL

    db: Session = SessionLocal()
    try:
        docs = db.query(Document).filter(Document.case_id == case_id).all()
        if not docs:
            raise HTTPException(status_code=404, detail="Case not found")

        ollama_url  = os.getenv("OLLAMA_URL",         OLLAMA_URL)
        embed_model = os.getenv("OLLAMA_EMBED_MODEL", OLLAMA_EMBED_MODEL)
        qdrant_url  = os.getenv("QDRANT_URL",         QDRANT_URL)

        ollama_client = ollama.Client(host=ollama_url)
        qdrant        = QdrantClient(url=qdrant_url, timeout=10)

        # Ensure collection exists
        try:
            qdrant.get_collection(QDRANT_COLLECTION)
        except Exception:
            qdrant.create_collection(
                collection_name=QDRANT_COLLECTION,
                vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
            )

        points: list[PointStruct] = []
        skipped = 0

        for doc in docs:
            if doc.status != "completed":
                skipped += 1
                continue

            subdocs = (
                db.query(SubDocument)
                .filter(SubDocument.document_id == doc.id)
                .all()
            )

            for sd in subdocs:
                content = (
                    db.query(SubDocumentContent)
                    .filter(SubDocumentContent.sub_document_id == sd.id)
                    .first()
                )
                if not content:
                    continue

                from app.services.embeddings import _chunks

                header = "\n".join(filter(None, [
                    content.title,
                    content.subject,
                    content.summary,
                    " ".join(json.loads(content.key_findings or "[]")),
                    " ".join(json.loads(content.key_actions  or "[]")),
                ]))

                text_chunks = _chunks(content.main_content or "")
                for chunk_idx, chunk_text in enumerate(text_chunks):
                    embed_text = f"{header}\n{chunk_text}".strip()[:8000]
                    if not embed_text:
                        continue

                    resp   = ollama_client.embeddings(model=embed_model, prompt=embed_text)
                    vector = resp.embedding

                    points.append(PointStruct(
                        id=str(_uuid.uuid4()),
                        vector=vector,
                        payload={
                            "case_id":         case_id,
                            "document_id":     doc.id,
                            "sub_document_id": sd.id,
                            "title":           sd.title,
                            "document_type":   sd.document_type,
                            "start_page":      sd.start_page,
                            "end_page":        sd.end_page,
                            "chunk_index":     chunk_idx,
                            "chunk_total":     len(text_chunks),
                        },
                    ))

                logger.info(f"[reindex] Embedded sub-doc {sd.id} '{sd.title}' — {len(text_chunks)} chunk(s)")

        if points:
            qdrant.upsert(collection_name=QDRANT_COLLECTION, points=points)

        return {
            "case_id":         case_id,
            "embeddings_stored": len(points),
            "documents_skipped": skipped,
            "status":          "ok",
        }

    finally:
        db.close()


# ── Draft Progress ────────────────────────────────────────────────────────────

@router.get("/draft-progress/{case_id}", summary="Get draft generation progress")
def draft_progress(case_id: str):
    from app.services.ai_draft_generator import get_draft_progress
    return get_draft_progress(case_id)


# ── Saved Draft ───────────────────────────────────────────────────────────────

@router.get("/saved-draft/{case_id}", summary="Get latest saved draft for a case")
def get_saved_draft(case_id: str):
    from app.config import PDF_UPLOAD_DIR
    case_dir = PDF_UPLOAD_DIR / case_id
    if not case_dir.exists():
        raise HTTPException(status_code=404, detail="No saved draft found")
    drafts = sorted(case_dir.glob("draft_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not drafts:
        raise HTTPException(status_code=404, detail="No saved draft found")
    return json.loads(drafts[0].read_text(encoding="utf-8"))


@router.post("/save-draft/{case_id}", summary="Save updated draft (with HTML content) for a case")
async def save_draft(case_id: str, body: dict):
    from app.config import PDF_UPLOAD_DIR
    import time
    case_dir = PDF_UPLOAD_DIR / case_id
    case_dir.mkdir(parents=True, exist_ok=True)
    ts = int(time.time())
    draft_path = case_dir / f"draft_{ts}.json"
    draft_path.write_text(json.dumps(body, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"saved": True, "path": str(draft_path)}


# ── Generate Draft ────────────────────────────────────────────────────────────

@router.get("/generate-draft/{case_id}", summary="Generate draft report from sub-document content")
def generate_draft(case_id: str):
    from app.services.draft_generator import build_draft
    db: Session = SessionLocal()
    try:
        docs = (
            db.query(Document)
            .filter(Document.case_id == case_id)
            .order_by(Document.created_at.desc())
            .all()
        )
        if not docs:
            raise HTTPException(status_code=404, detail="Case not found")

        all_sub_docs = []
        doc_dicts = []
        for d in docs:
            subdocs = (
                db.query(SubDocument)
                .filter(SubDocument.document_id == d.id)
                .order_by(SubDocument.start_page)
                .all()
            )
            for sd in subdocs:
                content = (
                    db.query(SubDocumentContent)
                    .filter(SubDocumentContent.sub_document_id == sd.id)
                    .first()
                )
                all_sub_docs.append({
                    "id": sd.id,
                    "title": sd.title,
                    "document_type": sd.document_type,
                    "start_page": sd.start_page,
                    "end_page": sd.end_page,
                    "confidence_score": sd.confidence_score,
                    "content": {
                        "subject": content.subject if content else None,
                        "purpose": content.purpose if content else None,
                        "summary": content.summary if content else None,
                        "main_content": content.main_content if content else None,
                        "key_persons": json.loads(content.key_persons or "[]") if content else [],
                        "key_dates": json.loads(content.key_dates or "[]") if content else [],
                        "key_findings": json.loads(content.key_findings or "[]") if content else [],
                        "key_actions": json.loads(content.key_actions or "[]") if content else [],
                        "organizations": json.loads(content.organizations or "[]") if content else [],
                    } if content else None,
                })
            doc_dicts.append({
                "file_name": d.file_name,
                "original_name": d.original_name,
                "status": d.status,
                "total_pages": d.total_pages or 0,
            })

        from app.services.ai_draft_generator import generate_draft_rag
        from fastapi.responses import JSONResponse
        from app.config import PDF_UPLOAD_DIR
        from datetime import datetime
        logger.info(f"[draft] Generating RAG draft for case {case_id}")
        try:
            draft = generate_draft_rag(case_id, db)
        except Exception as exc:
            logger.error(f"[draft] Generation failed: {exc}")
            raise HTTPException(status_code=500, detail=str(exc))
        logger.info(f"[draft] RAG draft complete for case {case_id}")

        # Save draft to pdf-files/{case_id}/
        try:
            case_dir = PDF_UPLOAD_DIR / case_id
            case_dir.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            draft_path = case_dir / f"draft_{timestamp}.json"
            draft_path.write_text(json.dumps(draft, ensure_ascii=False, indent=2), encoding="utf-8")
            logger.info(f"[draft] Saved to {draft_path}")
        except Exception as exc:
            logger.warning(f"[draft] Failed to save draft file: {exc}")

        return JSONResponse(content=draft, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})
    finally:
        db.close()


# ── Dashboard Stats ───────────────────────────────────────────────────────────

@router.get("/stats", summary="Aggregated dashboard statistics")
def dashboard_stats():
    from app.models import SubDocument, SubDocumentContent
    from app.config import PDF_UPLOAD_DIR
    db: Session = SessionLocal()
    try:
        docs = db.query(Document).all()
        total_cases = len(set(d.case_id for d in docs))
        total_docs = len(docs)
        completed = sum(1 for d in docs if d.status == "completed")
        processing = sum(1 for d in docs if d.status == "processing")
        failed = sum(1 for d in docs if d.status == "failed")
        total_pages = sum(d.total_pages or 0 for d in docs)
        total_subdocs = db.query(SubDocument).count()

        # Count saved draft reports
        draft_count = sum(
            len(list((PDF_UPLOAD_DIR / d.case_id).glob("draft_*.json")))
            for d in docs
            if (PDF_UPLOAD_DIR / d.case_id).exists()
        )
        draft_count = len(set(  # unique cases with drafts
            d.case_id for d in docs
            if (PDF_UPLOAD_DIR / d.case_id).exists()
            and list((PDF_UPLOAD_DIR / d.case_id).glob("draft_*.json"))
        ))

        # Docs per month for chart (last 6 months)
        from collections import defaultdict
        monthly: dict = defaultdict(int)
        for d in docs:
            if d.created_at:
                key = d.created_at.strftime("%b %Y")
                monthly[key] += 1
        monthly_list = [{"month": k, "docs": v} for k, v in sorted(monthly.items(), key=lambda x: x[0])][-6:]

        # Pages per case (top 8)
        case_pages: dict = defaultdict(int)
        for d in docs:
            case_pages[d.case_id] += d.total_pages or 0
        top_cases = sorted(case_pages.items(), key=lambda x: x[1], reverse=True)[:8]
        pages_chart = [{"case": k, "pages": v} for k, v in top_cases]

        # Sub-document types distribution + avg confidence
        from collections import Counter
        from sqlalchemy import func as sqlfunc
        subdocs = db.query(SubDocument).all()
        type_counts = Counter(sd.document_type or "Unknown" for sd in subdocs)
        subdoc_types = [{"name": k, "value": v} for k, v in type_counts.most_common(8)]
        avg_confidence = db.query(sqlfunc.avg(SubDocument.confidence_score)).scalar() or 0

        # Processing time per day (last 7 days)
        from datetime import datetime, timedelta
        cutoff = datetime.utcnow() - timedelta(days=7)
        completed_docs = db.query(Document).filter(
            Document.status == "completed",
            Document.created_at >= cutoff
        ).all()
        daily_times: dict = defaultdict(list)
        for d in completed_docs:
            if d.created_at and d.updated_at:
                secs = (d.updated_at - d.created_at).total_seconds()
                if 0 < secs < 86400:
                    daily_times[d.created_at.strftime("%d %b")].append(secs / 60)
        processing_trend = [
            {"day": day, "avg_min": round(sum(times) / len(times), 1), "docs": len(times)}
            for day, times in sorted(daily_times.items())
        ]

        return {
            "total_cases": total_cases,
            "total_documents": total_docs,
            "completed_documents": completed,
            "processing_documents": processing,
            "failed_documents": failed,
            "total_pages": total_pages,
            "total_subdocuments": total_subdocs,
            "draft_reports": draft_count,
            "monthly_uploads": monthly_list,
            "pages_per_case": pages_chart,
            "doc_status": [
                {"name": "Completed", "value": completed},
                {"name": "Processing", "value": processing},
                {"name": "Failed", "value": failed},
            ],
            "subdoc_types": subdoc_types,
            "avg_confidence": round(float(avg_confidence) * 100, 1),
            "processing_trend": processing_trend,
        }
    finally:
        db.close()


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    case_id: str | None = None

@router.post("/chat", summary="RAG-based chatbot over case documents")
def chat(req: ChatRequest):
    from app.config import OLLAMA_URL, OLLAMA_DRAFT_MODEL, OLLAMA_EMBED_MODEL, QDRANT_URL, QDRANT_COLLECTION
    import os, ollama
    from qdrant_client import QdrantClient
    from qdrant_client.models import FieldCondition, Filter, MatchValue
    from app.services.ai_draft_generator import _fetch_content_from_db
    from app.database import SessionLocal

    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    db = SessionLocal()
    try:
        ollama_url  = os.getenv("OLLAMA_URL", OLLAMA_URL)
        embed_model = os.getenv("OLLAMA_EMBED_MODEL", OLLAMA_EMBED_MODEL)
        chat_model  = os.getenv("OLLAMA_DRAFT_MODEL", OLLAMA_DRAFT_MODEL)
        qdrant_url  = os.getenv("QDRANT_URL", QDRANT_URL)

        ollama_client = ollama.Client(host=ollama_url)
        qdrant = QdrantClient(url=qdrant_url, timeout=10)

        # Embed question
        embed_resp = ollama_client.embeddings(model=embed_model, prompt=req.question)

        # Build filter — scope to case if provided
        must = []
        if req.case_id:
            must.append(FieldCondition(key="case_id", match=MatchValue(value=req.case_id)))
        search_filter = Filter(must=must) if must else None

        hits = qdrant.search(
            collection_name=QDRANT_COLLECTION,
            query_vector=embed_resp.embedding,
            query_filter=search_filter,
            limit=5,
            with_payload=True,
        )

        if not hits:
            return {"answer": "No relevant documents found. Please upload and process case documents first.", "sources": []}

        # Fetch content for top hits
        seen, sources, blocks = set(), [], []
        for h in hits:
            p = h.payload or {}
            sd_id = p.get("sub_document_id")
            if sd_id and sd_id not in seen:
                seen.add(sd_id)
                block = _fetch_content_from_db(db, p.get("document_id"), p.get("start_page"), sd_id)
                if block:
                    blocks.append(block)
                    sources.append({
                        "title": p.get("title", "Document"),
                        "case_id": p.get("case_id", ""),
                        "pages": f"{p.get('start_page','?')}–{p.get('end_page','?')}",
                        "score": round(h.score, 3),
                    })

        context = "\n\n---\n\n".join(blocks[:4])

        system_prompt = """You are an Anti-Corruption Bureau investigation assistant. Answer questions based ONLY on the provided case document content. Be concise and factual. If the answer is not in the source, say so clearly."""

        user_msg = f"""SOURCE DOCUMENTS:\n{context}\n\nQUESTION: {req.question}\n\nAnswer based only on the source documents above."""

        response = ollama_client.chat(
            model=chat_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_msg},
            ],
            options={"temperature": 0.1},
        )

        return {
            "answer": response.message.content,
            "sources": sources[:3],
        }
    except Exception as exc:
        logger.error(f"[chat] Error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


# ── Cases ─────────────────────────────────────────────────────────────────────

@router.get("/cases", summary="List all unique case IDs with summary stats")
def list_cases():
    from app.models import Case
    db: Session = SessionLocal()
    try:
        docs = db.query(Document).order_by(Document.created_at.desc()).all()
        case_map: dict = {}
        for d in docs:
            cid = d.case_id
            if cid not in case_map:
                case_map[cid] = {
                    "case_id": cid,
                    "document_count": 0,
                    "completed_count": 0,
                    "processing_count": 0,
                    "failed_count": 0,
                    "total_pages": 0,
                    "last_uploaded": d.created_at.isoformat() if d.created_at else None,
                    "title": None,
                    "status": None,
                    "accused_name": None,
                }
            case_map[cid]["document_count"] += 1
            case_map[cid]["total_pages"] += d.total_pages or 0
            if d.status == "completed":
                case_map[cid]["completed_count"] += 1
            elif d.status == "failed":
                case_map[cid]["failed_count"] += 1
            elif d.status in ("processing", "uploaded"):
                case_map[cid]["processing_count"] += 1

        # Enrich with metadata from cases table
        if case_map:
            cases = db.query(Case).filter(Case.id.in_(list(case_map.keys()))).all()
            for c in cases:
                if c.id in case_map:
                    case_map[c.id]["title"] = c.title
                    case_map[c.id]["status"] = c.status
                    case_map[c.id]["accused_name"] = c.accused_name

        return {"cases": list(case_map.values())}
    finally:
        db.close()


# ── File serving ─────────────────────────────────────────────────────────────

@router.get("/file/{case_id}/{file_name}", summary="Serve the original PDF for inline viewing")
def serve_pdf(case_id: str, file_name: str):
    pdf_path = PDF_UPLOAD_DIR / case_id / file_name
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={file_name}"},
    )


# ── Case detail ───────────────────────────────────────────────────────────────

@router.get("/case/{case_id}", summary="Get all documents and sub-documents for a case")
def get_case_detail(case_id: str):
    from app.models import PipelineStageRun

    db: Session = SessionLocal()
    try:
        docs = (
            db.query(Document)
            .filter(Document.case_id == case_id)
            .order_by(Document.created_at.desc())
            .all()
        )
        if not docs:
            return {
                "case_id": case_id,
                "document_count": 0,
                "total_subdocuments": 0,
                "documents": [],
            }

        result_docs = []
        total_subdocs = 0

        for d in docs:
            # Get completed stages for this document
            completed_stages = [
                run.stage_name
                for run in db.query(PipelineStageRun).filter(
                    PipelineStageRun.document_id == d.id,
                    PipelineStageRun.status == "completed"
                ).all()
            ]

            subdocs = (
                db.query(SubDocument)
                .filter(SubDocument.document_id == d.id)
                .order_by(SubDocument.start_page)
                .all()
            )
            sd_list = []
            for sd in subdocs:
                content = (
                    db.query(SubDocumentContent)
                    .filter(SubDocumentContent.sub_document_id == sd.id)
                    .first()
                )
                sd_list.append({
                    "id": sd.id,
                    "title": sd.title,
                    "document_type": sd.document_type,
                    "start_page": sd.start_page,
                    "end_page": sd.end_page,
                    "confidence_score": sd.confidence_score,
                    "content": {
                        "subject": content.subject if content else None,
                        "purpose": content.purpose if content else None,
                        "summary": content.summary if content else None,
                        "main_content": content.main_content if content else None,
                        "key_persons": json.loads(content.key_persons or "[]") if content else [],
                        "key_dates": json.loads(content.key_dates or "[]") if content else [],
                        "key_findings": json.loads(content.key_findings or "[]") if content else [],
                        "key_actions": json.loads(content.key_actions or "[]") if content else [],
                        "organizations": json.loads(content.organizations or "[]") if content else [],
                    } if content else None,
                })
            total_subdocs += len(sd_list)
            result_docs.append({
                "document_id": d.id,
                "file_name": d.file_name,
                "original_name": d.original_name,
                "status": d.status,
                "current_stage": d.current_stage,
                "total_pages": d.total_pages or 0,
                "phase": d.phase,
                "error_message": d.error_message,
                "created_at": d.created_at.isoformat() if d.created_at else None,
                "completed_stages": completed_stages,
                "subdocument_count": len(sd_list),
                "subdocuments": sd_list,
            })

        return {
            "case_id": case_id,
            "document_count": len(result_docs),
            "total_subdocuments": total_subdocs,
            "documents": result_docs,
        }
    finally:
        db.close()


@router.post("/{document_id}/unlink", summary="Unlink a document from its case")
def unlink_document(document_id: int):
    db: Session = SessionLocal()
    try:
        d = db.query(Document).filter(Document.id == document_id).first()
        if not d:
            raise HTTPException(status_code=404, detail="Document not found")
        d.case_id = "" # unlink
        db.commit()
        return {"ok": True}
    finally:
        db.close()
