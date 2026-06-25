"""Proxy router for the external Speech Intelligence service.

The external API (http://98.86.63.69) does not emit CORS headers and requires a
secret X-API-Key, so the browser cannot call it directly. This router forwards
requests from the frontend, injecting the API key server-side.
"""
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

# Load backend/.env explicitly so config resolves regardless of launch cwd.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

router = APIRouter(prefix="/speech-intel", tags=["Speech Intelligence"])

BASE_URL = os.getenv("SPEECH_INTEL_BASE_URL", "http://98.86.63.69").rstrip("/")
API_KEY = os.getenv("SPEECH_INTEL_API_KEY", "")  # set in backend/.env
HEADERS = {"X-API-Key": API_KEY}
TIMEOUT = httpx.Timeout(120.0, connect=15.0)


def _forward(response: httpx.Response) -> JSONResponse:
    """Mirror the upstream JSON body and status code back to the caller."""
    try:
        payload = response.json()
    except ValueError:
        payload = {"detail": response.text or f"Upstream error ({response.status_code})"}
    return JSONResponse(status_code=response.status_code, content=payload)


def _upstream_error(exc: httpx.HTTPError) -> HTTPException:
    return HTTPException(status_code=502, detail=f"Speech Intelligence service unreachable: {exc}")


@router.get("/health")
async def health():
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            res = await client.get(f"{BASE_URL}/", headers=HEADERS)
        return {"status": "online" if res.status_code < 500 else "offline", "base_url": BASE_URL}
    except httpx.HTTPError:
        return {"status": "offline", "base_url": BASE_URL}


@router.post("/cases")
async def create_case():
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            res = await client.post(f"{BASE_URL}/cases", headers=HEADERS)
    except httpx.HTTPError as exc:
        raise _upstream_error(exc) from exc
    return _forward(res)


@router.post("/cases/{case_id}/files")
async def upload_file(case_id: str, audio: UploadFile = File(...)):
    data = await audio.read()
    files = {"audio": (audio.filename or "upload", data, audio.content_type or "application/octet-stream")}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            res = await client.post(f"{BASE_URL}/cases/{case_id}/files", headers=HEADERS, files=files)
    except httpx.HTTPError as exc:
        raise _upstream_error(exc) from exc
    return _forward(res)


@router.get("/jobs/{job_id}")
async def job_status(job_id: str):
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            res = await client.get(f"{BASE_URL}/jobs/{job_id}", headers=HEADERS)
    except httpx.HTTPError as exc:
        raise _upstream_error(exc) from exc
    return _forward(res)


@router.get("/jobs/{job_id}/result")
async def job_result(job_id: str):
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            res = await client.get(f"{BASE_URL}/jobs/{job_id}/result", headers=HEADERS)
    except httpx.HTTPError as exc:
        raise _upstream_error(exc) from exc
    return _forward(res)


@router.post("/jobs/{job_id}/rerun")
async def rerun_job(job_id: str):
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            res = await client.post(f"{BASE_URL}/jobs/{job_id}/rerun", headers=HEADERS)
    except httpx.HTTPError as exc:
        raise _upstream_error(exc) from exc
    return _forward(res)


@router.post("/cases/{case_id}/files/{file_id}/certify")
async def certify(case_id: str, file_id: str):
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            res = await client.post(f"{BASE_URL}/cases/{case_id}/files/{file_id}/certify", headers=HEADERS)
    except httpx.HTTPError as exc:
        raise _upstream_error(exc) from exc
    return _forward(res)
