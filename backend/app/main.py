import os
import ssl
import urllib.request
import warnings

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

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.log_handler import register_handler
from app.routers import pdf


@asynccontextmanager
async def lifespan(_: FastAPI):
    register_handler()
    init_db()
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

app.include_router(pdf.router)


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
