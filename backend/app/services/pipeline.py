import json
import logging
import os
from datetime import datetime

from app.database import SessionLocal
from app.models import (
    Document, OCRBlock, PageContent, SubDocument, SubDocumentContent,
    PipelineStageRun, SubDocumentDetection, ExtractedContent
)
from app.services.ai_content_extraction import extract_content
from app.services.ai_subdoc_detection import detect_subdocuments
from app.services.evidence_extractor import extract_all_evidence, serialize_evidence
from app.services.ocr import extract_ocr_blocks
from app.services.page_parser import reconstruct_page_text
from app.services.pdf_to_images import convert_pdf_to_images, delete_page_images
from app.services.progress_store import clear_progress, set_stage_progress

logger = logging.getLogger(__name__)

STAGE_CONVERTING  = "converting_pdf"
STAGE_OCR         = "running_ocr"
STAGE_RECONSTRUCT = "reconstructing_pages"
STAGE_DETECT      = "detecting_subdocuments"
STAGE_EXTRACT     = "extracting_content"
STAGE_STORE       = "storing_results"
STAGE_EMBEDDINGS  = "generating_embeddings"

STAGES_LIST = [
    STAGE_CONVERTING, STAGE_OCR, STAGE_RECONSTRUCT, STAGE_DETECT,
    STAGE_EXTRACT, STAGE_STORE, STAGE_EMBEDDINGS
]


def _mark_stage_completed(db, document_id: int, stage: str) -> None:
    run = db.query(PipelineStageRun).filter(
        PipelineStageRun.document_id == document_id,
        PipelineStageRun.stage_name == stage
    ).first()
    if run:
        run.status = "completed"
        run.completed_at = datetime.utcnow()
    else:
        db.add(PipelineStageRun(
            document_id=document_id,
            stage_name=stage,
            status="completed",
            completed_at=datetime.utcnow()
        ))
    db.commit()


def _is_stage_completed(db, document_id: int, stage: str) -> bool:
    run = db.query(PipelineStageRun).filter(
        PipelineStageRun.document_id == document_id,
        PipelineStageRun.stage_name == stage,
        PipelineStageRun.status == "completed"
    ).first()
    return run is not None


def _clear_downstream_data(db, document_id: int, start_stage: str) -> None:
    stage_idx = STAGES_LIST.index(start_stage)

    if stage_idx <= STAGES_LIST.index(STAGE_DETECT):
        db.query(SubDocumentDetection).filter(SubDocumentDetection.document_id == document_id).delete()
    if stage_idx <= STAGES_LIST.index(STAGE_EXTRACT):
        db.query(ExtractedContent).filter(ExtractedContent.document_id == document_id).delete()
    if stage_idx <= STAGES_LIST.index(STAGE_STORE):
        db.query(SubDocument).filter(SubDocument.document_id == document_id).delete()
    if stage_idx <= STAGES_LIST.index(STAGE_EMBEDDINGS):
        from qdrant_client import QdrantClient
        try:
            client = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))
            client.delete(
                collection_name="document_sections",
                points_selector={"filter": {"must": [{"field": "document_id", "match": {"value": document_id}}]}}
            )
        except Exception as exc:
            logger.warning(f"Could not clear Qdrant embeddings: {exc}")

    db.commit()


def _load_checkpoint_data(db, document_id: int, stage: str):
    if stage == STAGE_DETECT:
        return db.query(SubDocumentDetection).filter(
            SubDocumentDetection.document_id == document_id
        ).all()
    elif stage == STAGE_EXTRACT:
        return db.query(ExtractedContent).filter(
            ExtractedContent.document_id == document_id
        ).all()
    return None


def _stage(db, doc: Document, status: str, stage: str | None) -> None:
    doc.status = status
    doc.current_stage = stage
    db.commit()


def run_pipeline(document_id: int, case_id: str, file_name: str, start_stage: str | None = None) -> None:
    db = SessionLocal()
    try:
        if start_stage is None:
            start_stage = STAGE_CONVERTING

        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            logger.error(f"Document {document_id} not found — aborting")
            return

        start_idx = STAGES_LIST.index(start_stage)

        # ── Step 1: PDF → Images ──────────────────────────────────────────────
        if start_idx <= STAGES_LIST.index(STAGE_CONVERTING):
            _stage(db, doc, "processing", STAGE_CONVERTING)
            logger.info(f"[doc={document_id}] Converting PDF to images")
            image_paths = convert_pdf_to_images(case_id, file_name, document_id)
            doc.total_pages = len(image_paths)
            db.commit()
            _mark_stage_completed(db, document_id, STAGE_CONVERTING)
        else:
            image_paths = None

        total_pages = doc.total_pages or 0

        # ── Step 2: OCR ───────────────────────────────────────────────────────
        page_texts_raw = None
        if start_idx <= STAGES_LIST.index(STAGE_OCR):
            _stage(db, doc, "processing", STAGE_OCR)
            set_stage_progress(document_id, STAGE_OCR, 0, total_pages, "pages")
            logger.info(f"[doc={document_id}] Running OCR on {total_pages} pages")

            page_texts_raw = []
            for idx, image_path in enumerate(image_paths, start=1):
                page_num = int(image_path.stem.split("_")[1])
                blocks = extract_ocr_blocks(image_path, page_num, document_id)
                for b in blocks:
                    db.add(OCRBlock(**b))
                page_texts_raw.append((page_num, blocks))
                set_stage_progress(document_id, STAGE_OCR, idx, total_pages, "pages")
                logger.info(f"[doc={document_id}] OCR page {idx}/{total_pages}")
            db.commit()
            delete_page_images(case_id, document_id)
            _mark_stage_completed(db, document_id, STAGE_OCR)

        # ── Step 3: Reading-order reconstruction ──────────────────────────────
        reconstructed = None
        if start_idx <= STAGES_LIST.index(STAGE_RECONSTRUCT):
            _stage(db, doc, "processing", STAGE_RECONSTRUCT)
            set_stage_progress(document_id, STAGE_RECONSTRUCT, 0, total_pages, "pages")
            logger.info(f"[doc={document_id}] Reconstructing page text")

            reconstructed = []
            for idx, (page_num, blocks) in enumerate(page_texts_raw, start=1):
                page_text = reconstruct_page_text(blocks)
                db.add(PageContent(
                    document_id=document_id,
                    case_id=case_id,
                    page_number=page_num,
                    page_text=page_text,
                ))
                reconstructed.append((page_num, page_text))
                set_stage_progress(document_id, STAGE_RECONSTRUCT, idx, total_pages, "pages")
            db.commit()
            _mark_stage_completed(db, document_id, STAGE_RECONSTRUCT)
        else:
            # Load reconstructed data from database if not re-running this stage
            if start_idx > STAGES_LIST.index(STAGE_RECONSTRUCT):
                page_contents = db.query(PageContent).filter(
                    PageContent.document_id == document_id
                ).order_by(PageContent.page_number).all()
                if page_contents:
                    reconstructed = [(pc.page_number, pc.page_text) for pc in page_contents]

        # ── Step 4: AI Sub-document Detection ────────────────────────────────
        subdocs = None
        if start_idx <= STAGES_LIST.index(STAGE_DETECT):
            _stage(db, doc, "processing", STAGE_DETECT)
            set_stage_progress(document_id, STAGE_DETECT, 0, 0, "pages")
            logger.info(f"[doc={document_id}] Detecting sub-documents across {total_pages} pages")

            subdocs = detect_subdocuments(reconstructed, document_id=document_id)
            set_stage_progress(document_id, STAGE_DETECT, total_pages, total_pages, "pages")
            logger.info(f"[doc={document_id}] Found {len(subdocs)} sub-document(s)")

            # Store checkpoint
            for subdoc in subdocs:
                db.add(SubDocumentDetection(
                    document_id=document_id,
                    title=subdoc.get("title"),
                    document_type=subdoc.get("document_type"),
                    start_page=subdoc.get("start_page"),
                    end_page=subdoc.get("end_page"),
                    confidence=subdoc.get("confidence")
                ))
            db.commit()
            _mark_stage_completed(db, document_id, STAGE_DETECT)
        elif start_idx <= STAGES_LIST.index(STAGE_EXTRACT):
            # Load from checkpoint
            detections = _load_checkpoint_data(db, document_id, STAGE_DETECT)
            subdocs = [
                {
                    "title": d.title,
                    "document_type": d.document_type,
                    "start_page": d.start_page,
                    "end_page": d.end_page,
                    "confidence": d.confidence
                }
                for d in detections
            ]

        page_map = {pn: txt for pn, txt in reconstructed} if reconstructed else {}
        total_subdocs = len(subdocs) if subdocs else 0

        # ── Step 5: Content Extraction ────────────────────────────────────────
        extracted = None
        if start_idx <= STAGES_LIST.index(STAGE_EXTRACT):
            _stage(db, doc, "processing", STAGE_EXTRACT)
            set_stage_progress(document_id, STAGE_EXTRACT, 0, total_subdocs, "sub-documents")
            logger.info(f"[doc={document_id}] Extracting content from {total_subdocs} sub-document(s)")

            extracted = []
            for i, subdoc in enumerate(subdocs, start=1):
                start = subdoc.get("start_page", 1)
                end = subdoc.get("end_page", total_pages)
                logger.info(f"[doc={document_id}]   [{i}/{total_subdocs}] Extracting: '{subdoc.get('title', '')}' (pp {start}–{end})")
                full_text = "\n\n".join(page_map[pn] for pn in sorted(page_map) if start <= pn <= end)
                content = extract_content(full_text)
                extracted.append((subdoc, content))

                # Store checkpoint
                db.add(ExtractedContent(
                    document_id=document_id,
                    subdoc_title=subdoc.get("title"),
                    subject=content.get("subject"),
                    purpose=content.get("purpose"),
                    main_content=content.get("main_content"),
                    key_persons=json.dumps(content.get("important_people") or []),
                    key_dates=json.dumps(content.get("important_dates") or []),
                    key_findings=json.dumps(content.get("key_findings") or []),
                    key_actions=json.dumps(content.get("key_actions") or []),
                    organizations=json.dumps(content.get("important_organizations") or [])
                ))
                db.commit()
                set_stage_progress(document_id, STAGE_EXTRACT, i, total_subdocs, "sub-documents")
            _mark_stage_completed(db, document_id, STAGE_EXTRACT)
        elif start_idx <= STAGES_LIST.index(STAGE_STORE):
            # Load from checkpoint
            extracted_data = _load_checkpoint_data(db, document_id, STAGE_EXTRACT)
            extracted = [
                (
                    {"title": e.subdoc_title},
                    {
                        "subject": e.subject,
                        "purpose": e.purpose,
                        "main_content": e.main_content,
                        "important_people": json.loads(e.key_persons or "[]"),
                        "important_dates": json.loads(e.key_dates or "[]"),
                        "key_findings": json.loads(e.key_findings or "[]"),
                        "key_actions": json.loads(e.key_actions or "[]"),
                        "important_organizations": json.loads(e.organizations or "[]")
                    }
                )
                for e in extracted_data
            ]

        # ── Step 6: Store ─────────────────────────────────────────────────────
        subdoc_ids = None
        if start_idx <= STAGES_LIST.index(STAGE_STORE):
            _stage(db, doc, "processing", STAGE_STORE)
            set_stage_progress(document_id, STAGE_STORE, 0, total_subdocs, "sub-documents")
            logger.info(f"[doc={document_id}] Storing {total_subdocs} sub-document(s)")

            subdoc_ids = []
            for i, (subdoc_meta, content) in enumerate(extracted, start=1):
                start = subdoc_meta.get("start_page", 1)
                end = subdoc_meta.get("end_page", total_pages)

                sd = SubDocument(
                    document_id=document_id,
                    case_id=case_id,
                    title=subdoc_meta.get("title") or content.get("title") or "Untitled",
                    document_type=subdoc_meta.get("document_type", "Unknown"),
                    start_page=start,
                    end_page=end,
                    confidence_score=float(subdoc_meta.get("confidence", 0.5)),
                    phase=doc.phase,
                )
                db.add(sd)
                db.flush()
                subdoc_ids.append(sd.id)

                # Extract structured evidence from main content
                main_content = content.get("main_content", "")
                evidence = extract_all_evidence(main_content)
                evidence_json = serialize_evidence(evidence)

                db.add(SubDocumentContent(
                    sub_document_id=sd.id,
                    title=content.get("title"),
                    subject=content.get("subject"),
                    purpose=content.get("purpose"),
                    summary=content.get("executive_summary"),
                    main_content=main_content,
                    key_persons=json.dumps(content.get("important_people") or []),
                    key_dates=json.dumps(content.get("important_dates") or []),
                    key_findings=json.dumps(content.get("key_findings") or []),
                    key_actions=json.dumps(content.get("key_actions") or []),
                    organizations=json.dumps(content.get("important_organizations") or []),
                    evidence_objects=evidence_json,
                ))
                set_stage_progress(document_id, STAGE_STORE, i, total_subdocs, "sub-documents")
                logger.info(f"[doc={document_id}]   Stored sub-doc {i}/{total_subdocs}")

            db.commit()
            _mark_stage_completed(db, document_id, STAGE_STORE)

        # ── Step 7: Embeddings ────────────────────────────────────────────────
        if start_idx <= STAGES_LIST.index(STAGE_EMBEDDINGS):
            # Load from DB if resuming directly at this stage (extracted/subdoc_ids not in memory)
            if extracted is None or subdoc_ids is None:
                subdocs_db = db.query(SubDocument).filter(SubDocument.document_id == document_id).all()
                subdoc_ids = [sd.id for sd in subdocs_db]
                total_subdocs = len(subdoc_ids)
                extracted = []
                for sd in subdocs_db:
                    c = db.query(SubDocumentContent).filter(
                        SubDocumentContent.sub_document_id == sd.id
                    ).first()
                    subdoc_meta = {
                        "title": sd.title,
                        "document_type": sd.document_type,
                        "start_page": sd.start_page,
                        "end_page": sd.end_page,
                    }
                    content = {
                        "title": c.title if c else None,
                        "subject": c.subject if c else None,
                        "executive_summary": c.summary if c else None,
                        "main_content": c.main_content if c else "",
                        "key_findings": json.loads(c.key_findings) if c and c.key_findings else [],
                        "key_actions": json.loads(c.key_actions) if c and c.key_actions else [],
                    }
                    extracted.append((subdoc_meta, content))

            _stage(db, doc, "processing", STAGE_EMBEDDINGS)
            set_stage_progress(document_id, STAGE_EMBEDDINGS, 0, total_subdocs, "embeddings")
            logger.info(f"[doc={document_id}] Generating {total_subdocs} embedding(s)")

            from app.services.embeddings import store_subdoc_embeddings
            store_subdoc_embeddings(
                extracted, case_id, document_id, subdoc_ids,
                progress_callback=lambda i, n: set_stage_progress(document_id, STAGE_EMBEDDINGS, i, n, "embeddings"),
            )
            _mark_stage_completed(db, document_id, STAGE_EMBEDDINGS)

        _stage(db, doc, "completed", None)
        clear_progress(document_id)
        logger.info(f"[doc={document_id}] Pipeline complete")

    except Exception as exc:
        logger.exception(f"[doc={document_id}] Pipeline failed: {exc}")
        db.close()
        db = SessionLocal()
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = "failed"
            doc.error_message = str(exc)
            db.commit()
        clear_progress(document_id)
    finally:
        db.close()
