import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def run_remote_ocr(pdf_path: Path, document_id: int, progress_callback=None) -> dict[int, str]:
    """
    Uploads the PDF to the remote OCR service, polls until finished,
    and returns a dictionary of page_num -> markdown_text.
    """
    import time
    import requests
    from app.config import SPEECH_INTEL_BASE_URL, SPEECH_INTEL_API_KEY

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF file not found at {pdf_path}")

    url = f"{SPEECH_INTEL_BASE_URL.rstrip('/')}/ocr/jobs"
    headers = {
        "Authorization": f"Bearer {SPEECH_INTEL_API_KEY}"
    }

    logger.info(f"[doc={document_id}] Uploading PDF to remote OCR service: {pdf_path.name}")
    with open(pdf_path, "rb") as f:
        files = {"file": (pdf_path.name, f, "application/pdf")}
        response = requests.post(url, headers=headers, files=files, timeout=60)

    if response.status_code != 202:
        raise Exception(f"Failed to submit OCR job: {response.status_code} - {response.text}")

    job_data = response.json()
    job_id = job_data["job_id"]
    total_pages = job_data.get("total_pages", 0)
    logger.info(f"[doc={document_id}] Remote OCR job created: {job_id} ({total_pages} pages)")

    # Poll job status
    status_url = f"{url}/{job_id}"
    while True:
        time.sleep(3)
        try:
            status_resp = requests.get(status_url, headers=headers, timeout=10)
            if status_resp.status_code != 200:
                logger.warning(f"Error polling OCR job {job_id}: {status_resp.status_code}")
                continue

            status_data = status_resp.json()
            status = status_data.get("status")
            pages_done = status_data.get("pages_done", 0)
            total = status_data.get("total_pages", total_pages) or total_pages

            logger.info(f"[doc={document_id}] Job {job_id[:8]} status: {status} ({pages_done}/{total} pages)")

            if progress_callback and total > 0:
                progress_callback(pages_done, total)

            if status == "done":
                break
            elif status == "failed":
                error_msg = status_data.get("error", "Unknown error")
                raise Exception(f"Remote OCR job failed: {error_msg}")
        except requests.RequestException as e:
            logger.warning(f"Request error polling OCR job {job_id}: {e}")
            continue

    # Download results
    result_url = f"{status_url}/result"
    logger.info(f"[doc={document_id}] Downloading OCR results for job {job_id}")
    result_resp = requests.get(result_url, headers=headers, timeout=60)
    if result_resp.status_code != 200:
        raise Exception(f"Failed to download OCR results: {result_resp.status_code} - {result_resp.text}")

    markdown_text = result_resp.text

    # Parse markdown into pages
    pages = {}
    import re
    parts = re.split(r'\n+---\n+', markdown_text)

    for idx, part in enumerate(parts):
        part = part.strip()
        if not part:
            continue
        # Extract page number
        match = re.match(r'^## Page (\d+)\s*\n+(.*)', part, re.DOTALL)
        if match:
            p_num = int(match.group(1))
            body = match.group(2).strip()
            pages[p_num] = body
        else:
            p_num = idx + 1
            body = re.sub(r'^## Page \d+\s*\n+', '', part).strip()
            pages[p_num] = body

    # Ensure all pages are populated
    for p in range(1, total_pages + 1):
        if p not in pages:
            pages[p] = ""

    return pages


def make_mock_ocr_blocks(page_text: str, page_number: int, document_id: int) -> list[dict]:
    """
    Converts a plain text page into mock OCRBlock objects.
    This preserves the ability to run downstream stages that expect OCRBlock data.
    """
    blocks = []
    lines = page_text.split("\n")
    for idx, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        blocks.append({
            "document_id": document_id,
            "page_number": page_number,
            "text": line,
            "x": 0.0,
            "y": float(idx * 20),
            "width": 100.0,
            "height": 15.0,
            "confidence": 1.0
        })
    return blocks

