from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.database import Base


class Case(Base):
    __tablename__ = "cases"

    id                  = Column(String, primary_key=True)
    case_number         = Column(String, unique=True, nullable=False)
    title               = Column(String, nullable=False)
    type                = Column(String, nullable=False)
    fir_number          = Column(String)
    status              = Column(String, default="active")
    officer_id          = Column(String)
    officer_name        = Column(String)
    officer_department  = Column(String)
    accused_name        = Column(String)
    accused_designation = Column(String)
    accused_department  = Column(String)
    accused_contact     = Column(String)
    complaint_summary   = Column(Text)
    incident_date       = Column(String)
    location            = Column(String)
    amount_involved     = Column(Float, default=0)
    documents_count     = Column(Integer, default=0)
    drafts_count        = Column(Integer, default=0)
    tags                = Column(Text)  # JSON array
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(String, index=True, nullable=False)
    file_name = Column(String, nullable=False)
    original_name = Column(String)
    file_path = Column(String)
    status = Column(String, default="uploaded")  # uploaded | processing | completed | failed
    current_stage = Column(String, nullable=True)
    total_pages = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OCRBlock(Base):
    __tablename__ = "ocr_blocks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True, nullable=False)
    page_number = Column(Integer, nullable=False)
    text = Column(Text)
    x = Column(Float)
    y = Column(Float)
    width = Column(Float)
    height = Column(Float)
    confidence = Column(Float)


class PageContent(Base):
    __tablename__ = "page_content"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True, nullable=False)
    case_id = Column(String, index=True)
    page_number = Column(Integer, nullable=False)
    page_text = Column(Text)


class SubDocument(Base):
    __tablename__ = "sub_documents"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True, nullable=False)
    case_id = Column(String, index=True)
    title = Column(String)
    document_type = Column(String)
    start_page = Column(Integer)
    end_page = Column(Integer)
    confidence_score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


class SubDocumentContent(Base):
    __tablename__ = "sub_document_content"

    id = Column(Integer, primary_key=True, index=True)
    sub_document_id = Column(Integer, ForeignKey("sub_documents.id"), index=True, nullable=False)
    title = Column(String)
    subject = Column(Text)
    purpose = Column(Text)
    summary = Column(Text)
    main_content = Column(Text)
    key_persons = Column(Text)    # JSON array
    key_dates = Column(Text)      # JSON array
    key_findings = Column(Text)   # JSON array
    key_actions = Column(Text)    # JSON array
    organizations = Column(Text)  # JSON array
    evidence_objects = Column(Text, nullable=True)  # JSON: {witnesses, currency_notes, cdr_records, findings, evidence_type}
    created_at = Column(DateTime, default=datetime.utcnow)


class PipelineStageRun(Base):
    __tablename__ = "pipeline_stage_runs"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True, nullable=False)
    stage_name = Column(String, nullable=False)  # converting_pdf, running_ocr, etc.
    status = Column(String, default="pending")  # pending | completed | failed
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)


class SubDocumentDetection(Base):
    __tablename__ = "sub_document_detections"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True, nullable=False)
    title = Column(String)
    document_type = Column(String)
    start_page = Column(Integer)
    end_page = Column(Integer)
    confidence = Column(Float)


class ExtractedContent(Base):
    __tablename__ = "extracted_contents"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), index=True, nullable=False)
    subdoc_title = Column(String)
    subject = Column(Text)
    purpose = Column(Text)
    main_content = Column(Text)
    key_persons = Column(Text)    # JSON array
    key_dates = Column(Text)      # JSON array
    key_findings = Column(Text)   # JSON array
    key_actions = Column(Text)    # JSON array
    organizations = Column(Text)  # JSON array


class MediaRecord(Base):
    __tablename__ = "media_records"

    id                   = Column(String, primary_key=True)   # uuid4
    case_id              = Column(String, index=True, nullable=False)  # ref to cases.id (no FK constraint)
    file_name            = Column(String)
    audio_description    = Column(Text)
    language             = Column(String)
    language_name        = Column(String)
    target_language      = Column(String)
    target_language_name = Column(String)
    task                 = Column(String)                     # "transcribe" | "translate"
    text                 = Column(Text)
    original_text        = Column(Text)
    segments             = Column(Text)                       # json.dumps([{speaker, start, end, text}, ...])
    original_segments    = Column(Text)                       # json.dumps([...]) or NULL
    speaker_count        = Column(Integer, default=0)
    diarization          = Column(Integer, default=0)         # 0/1
    processing_time      = Column(Float)
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
