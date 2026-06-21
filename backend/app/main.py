import os
import ssl
import urllib.request
import warnings

# Required for PaddleOCR compatibility when protobuf >= 4.x is installed
# (pyannote.audio pulls in opentelemetry which needs protobuf 6.x;
#  PaddlePaddle's generated _pb2 files only work with pure-Python impl)
os.environ.setdefault("PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION", "python")

# ── SSL bypass for PaddleOCR model downloads from Baidu CDN ──────────────────
# PaddleOCR uses `requests` (urllib3) internally — the standard ssl patch alone
# does not help. Must patch all three layers.

# 1. urllib ssl context
ssl._create_default_https_context = ssl._create_unverified_context
os.environ["PYTHONHTTPSVERIFY"] = "0"

# 2. urllib opener (urlretrieve path)
_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE
urllib.request.install_opener(
    urllib.request.build_opener(urllib.request.HTTPSHandler(context=_ctx))
)

# 3. requests / urllib3 (PaddleOCR download_with_progressbar uses requests.get)
try:
    import requests
    import urllib3
    warnings.filterwarnings("ignore", category=urllib3.exceptions.InsecureRequestWarning)
    urllib3.disable_warnings()
    _orig_request = requests.Session.request

    def _request_no_verify(self, method, url, **kwargs):
        kwargs.setdefault("verify", False)
        return _orig_request(self, method, url, **kwargs)

    requests.Session.request = _request_no_verify
except ImportError:
    pass

import json
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal, init_db
from app.log_handler import register_handler
from app.routers import pdf, stt
from app.routers import cases as cases_router
from app.routers import media_records as media_records_router
from app.routers import complaints as complaints_router
from app.routers import workflow as workflow_router
from app.routers import dashboard as dashboard_router
from app.routers import settings as settings_router
from app.routers import report_templates as report_templates_router


def _seed_report_templates() -> None:
    from app.services.report_templates import seed_report_templates

    db = SessionLocal()
    try:
        count = seed_report_templates(db)
        print(f"[startup] Ensured {count} report templates")
    finally:
        db.close()


def _seed_workflow_cases() -> None:
    """Seed sample complaints and cases across phases for demo."""
    import uuid
    from app.models import Complaint, Case
    from app.services.case_workflow import ensure_checkpoints

    db = SessionLocal()
    try:
        if db.query(Complaint).count() > 0:
            return

        samples = [
            ("Sri M. Srinivas", "Sri K. Venkateswara Rao", "Panchayat Raj", "Warangal", 50000, "verification", "high"),
            ("Smt. P. Lalitha", "Sri B. Ramesh", "Registration & Stamps", "Karimnagar", 100000, "approval", "critical"),
            ("Sri N. Harish", "Smt. P. Lakshmi", "Revenue", "Rangareddy", 25000, "complaint", "medium"),
            ("Sri A. Raju", "Sri A. Saidulu", "Rural Development", "Nalgonda", 75000, "trap", "high"),
            ("Sri V. Prasad", "Sri N. Prasad", "Irrigation", "Khammam", 200000, "remand", "critical"),
        ]
        year = datetime.utcnow().year
        for i, (complainant, accused, dept, loc, amt, phase, priority) in enumerate(samples, 1):
            cid = f"complaint-seed-{i}"
            tracking = f"CMP-{year}-{str(180 + i).zfill(4)}"
            case_id = f"case-seed-{i}"
            case_tracking = f"TS-ACB-{year}-RCT-{str(140 + i).zfill(4)}"

            substatus_map = {
                "complaint": "draft",
                "verification": "in_progress",
                "approval": "submitted",
                "trap": "scheduled",
                "remand": "custody_active",
            }

            db.add(Complaint(
                id=cid,
                tracking_id=tracking,
                case_id=case_id,
                complainant_name=complainant,
                accused_name=accused,
                accused_department=dept,
                location=loc,
                amount_involved=amt,
                channel="Walk-in",
                priority=priority,
                language="te" if i % 2 else "en",
                status="submitted",
                dsp_name="DSP Ramesh Kumar",
            ))
            db.add(Case(
                id=case_id,
                case_number=f"ACB/{year}/{str(100 + i).zfill(3)}",
                tracking_id=case_tracking,
                title=f"Trap Case — {accused}",
                type="trap",
                status="active",
                current_phase=phase,
                phase_substatus=substatus_map.get(phase, "active"),
                priority=priority,
                language="te" if i % 2 else "en",
                complaint_id=cid,
                dsp_name="DSP Ramesh Kumar",
                officer_name="Insp. D. Prakash Reddy",
                accused_name=accused,
                accused_department=dept,
                location=loc,
                amount_involved=amt,
                tags=json.dumps(["trap", priority]),
            ))
            db.flush()
            ensure_checkpoints(db, case_id, phase)

        db.commit()
        print(f"[startup] Seeded {len(samples)} workflow demo cases")
    finally:
        db.close()


def _seed_cases() -> None:
    """Seed cases.json on first run, then backfill any document case_ids missing from cases table."""
    from app.models import Case, Document
    db = SessionLocal()
    try:
        if db.query(Case).count() == 0:
            json_path = Path(__file__).parents[2] / "frontend" / "data" / "cases.json"
            if json_path.exists():
                data = json.loads(json_path.read_text(encoding="utf-8"))
                for c in data:
                    db.add(Case(
                        id=c["id"],
                        case_number=c.get("caseNumber", c["id"]),
                        title=c["title"],
                        type=c["type"],
                        fir_number=c.get("firNumber"),
                        status=c.get("status", "active"),
                        officer_id=c.get("officerId"),
                        officer_name=c.get("officerName"),
                        officer_department=c.get("officerDepartment"),
                        accused_name=c.get("accusedName"),
                        accused_designation=c.get("accusedDesignation"),
                        accused_department=c.get("accusedDepartment"),
                        accused_contact=c.get("accusedContact"),
                        complaint_summary=c.get("complaintSummary"),
                        incident_date=c.get("incidentDate"),
                        location=c.get("location"),
                        amount_involved=c.get("amountInvolved", 0),
                        documents_count=c.get("documentsCount", 0),
                        drafts_count=c.get("draftsCount", 0),
                        tags=json.dumps(c.get("tags", [])),
                    ))
                db.commit()
                print(f"[startup] Seeded {len(data)} cases from cases.json")

        # Backfill stub cases for any document case_id with no parent in cases table
        doc_ids = {r[0] for r in db.query(Document.case_id).distinct().all()}
        existing = {r[0] for r in db.query(Case.id).all()}
        missing = doc_ids - existing
        if missing:
            count = db.query(Case).count()
            year = datetime.utcnow().year
            for cid in sorted(missing):
                count += 1
                docs = db.query(Document).filter(Document.case_id == cid).order_by(Document.created_at).all()
                first_created = docs[0].created_at if docs else datetime.utcnow()
                db.add(Case(
                    id=cid,
                    case_number=f"ACB/{year}/{str(count).zfill(3)}",
                    title=f"Case {cid}",
                    type="other",
                    status="active",
                    documents_count=len(docs),
                    tags=json.dumps([]),
                    created_at=first_created,
                    updated_at=first_created,
                ))
            db.commit()
            print(f"[startup] Backfilled {len(missing)} stub cases from documents table")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    register_handler()
    init_db()
    _seed_report_templates()
    _seed_cases()
    _seed_workflow_cases()
    yield


app = FastAPI(
    title="ACB Investigation API",
    description="Anti-Corruption Bureau — Backend API for document processing and case management.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases_router.router)
app.include_router(complaints_router.router)
app.include_router(workflow_router.router)
app.include_router(dashboard_router.router)
app.include_router(settings_router.router)
app.include_router(report_templates_router.router)
app.include_router(media_records_router.router)
app.include_router(pdf.router)
app.include_router(stt.router)


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "ACB Investigation API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}


@app.get("/pdf/draft-progress/{case_id}", tags=["Draft"])
async def draft_progress_direct(case_id: str):
    from app.services.ai_draft_generator import get_draft_progress
    return get_draft_progress(case_id)


@app.get("/test-ping/{val}", tags=["Debug"])
async def test_ping(val: str):
    return {"pong": val}
