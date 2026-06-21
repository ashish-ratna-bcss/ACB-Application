from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text

from app.database import Base


class Case(Base):
    __tablename__ = "cases"

    id                  = Column(String, primary_key=True)
    case_number         = Column(String, unique=True, nullable=False)
    tracking_id         = Column(String, unique=True, nullable=True)  # e.g. TS-ACB-2026-RCT-0142
    title               = Column(String, nullable=False)
    type                = Column(String, nullable=False)
    fir_number          = Column(String)
    status              = Column(String, default="active")
    current_phase       = Column(String, default="complaint")
    phase_substatus     = Column(String, default="draft")
    priority            = Column(String, default="medium")
    language            = Column(String, default="en")  # en | te | bilingual
    complaint_id        = Column(String, nullable=True)  # ref to complaints.id
    dsp_id              = Column(String)
    dsp_name            = Column(String)
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
    judicial_outcome    = Column(String)  # convicted | acquitted | dismissed
    phase_data          = Column(Text)    # JSON blob for phase-specific fields
    tags                = Column(Text)  # JSON array
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Complaint(Base):
    __tablename__ = "complaints"

    id                  = Column(String, primary_key=True)
    tracking_id         = Column(String, unique=True, nullable=False)
    case_id             = Column(String, ForeignKey("cases.id"), nullable=True)
    complainant_name    = Column(String, nullable=False)
    accused_name        = Column(String, nullable=False)
    accused_designation = Column(String)
    accused_department  = Column(String)
    location            = Column(String)
    amount_involved     = Column(Float, default=0)
    channel             = Column(String, default="Walk-in")
    priority            = Column(String, default="medium")
    language            = Column(String, default="en")
    status              = Column(String, default="draft")  # draft | assigned | submitted
    dsp_id              = Column(String)
    dsp_name            = Column(String)
    summary             = Column(Text)
    has_evidence        = Column(Integer, default=0)
    complaint_type      = Column(String, default="initial")  # initial | further | draft
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PhaseTransition(Base):
    __tablename__ = "phase_transitions"

    id           = Column(Integer, primary_key=True, index=True)
    case_id      = Column(String, ForeignKey("cases.id"), index=True, nullable=False)
    from_phase   = Column(String)
    to_phase     = Column(String, nullable=False)
    action       = Column(String)
    notes        = Column(Text)
    actor_id     = Column(String)
    actor_name   = Column(String)
    actor_role   = Column(String, default="io")
    created_at   = Column(DateTime, default=datetime.utcnow)


class PhaseCheckpoint(Base):
    __tablename__ = "phase_checkpoints"

    id         = Column(Integer, primary_key=True, index=True)
    case_id    = Column(String, ForeignKey("cases.id"), index=True, nullable=False)
    phase      = Column(String, nullable=False)
    key        = Column(String, nullable=False)
    label      = Column(String, nullable=False)
    done       = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PhaseArtifact(Base):
    __tablename__ = "phase_artifacts"

    id            = Column(Integer, primary_key=True, index=True)
    case_id       = Column(String, ForeignKey("cases.id"), index=True, nullable=False)
    phase         = Column(String, nullable=False)
    artifact_type = Column(String, nullable=False)  # document | media | draft | report
    ref_id        = Column(String)
    title         = Column(String)
    status        = Column(String, default="linked")
    created_at    = Column(DateTime, default=datetime.utcnow)


class Approval(Base):
    __tablename__ = "approvals"

    id              = Column(Integer, primary_key=True, index=True)
    case_id         = Column(String, ForeignKey("cases.id"), index=True, nullable=False)
    approval_type   = Column(String, nullable=False)  # verification | trap | fir
    status          = Column(String, default="pending")  # pending | approved | rejected
    authority       = Column(String)
    authority_name  = Column(String)
    decision_notes  = Column(Text)
    decided_at      = Column(DateTime)
    created_at      = Column(DateTime, default=datetime.utcnow)


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id              = Column(String, primary_key=True)
    case_id         = Column(String, ForeignKey("cases.id"), index=True, nullable=False)
    evidence_type   = Column(String, nullable=False)  # audio | video | document | currency | apparel
    title           = Column(String)
    description     = Column(Text)
    file_hash       = Column(String)
    embedding_ref   = Column(String)  # Qdrant point id
    status          = Column(String, default="logged")  # logged | secured | archived
    uploaded_by     = Column(String)
    last_accessed_by = Column(String)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(Integer, primary_key=True, index=True)
    case_id     = Column(String, index=True)
    user_id     = Column(String)
    user_name   = Column(String)
    action      = Column(String, nullable=False)
    resource    = Column(String)
    details     = Column(Text)
    created_at  = Column(DateTime, default=datetime.utcnow)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key        = Column(String, primary_key=True)
    value      = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ReportTemplate(Base):
    __tablename__ = "report_templates"

    id             = Column(String, primary_key=True)
    phase          = Column(String, nullable=False, index=True)
    title          = Column(String, nullable=False)
    short_title    = Column(String)
    description    = Column(Text)
    document_type  = Column(String, nullable=False)
    sort_order     = Column(Integer, default=0)
    structure      = Column(Text, nullable=False)  # JSON: sections + fields
    version        = Column(String, default="1.0")
    is_active      = Column(Integer, default=1)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
    phase = Column(String, nullable=True)  # complaints | verification | approval | trap | remand | investigation | evidence | court | prosecution | full_case
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
    phase = Column(String, nullable=True)  # inherited from parent Document
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
