import logging
from pathlib import Path

from app.config import PDF_UPLOAD_DIR, POPPLER_PATH

logger = logging.getLogger(__name__)

# pdf2image on Windows: _get_command_path adds ".exe" before os.path.join, so
# passing POPPLER_PATH here yields "...\bin\pdfinfo.exe" — correct absolute path.
# Fall back to None (PATH lookup) when POPPLER_PATH is empty.
_POPPLER_PATH = POPPLER_PATH or None

# Pages per pdf2image subprocess call.
# Old approach: 1 call per page (500 calls for 500 pages).
# New approach: 1 call per batch (10 calls for 500 pages).
_CONVERT_BATCH = 50

# 200 DPI is sufficient for PaddleOCR on text documents.
# Reduces per-page PNG size by ~56% vs 300 DPI.
_DPI = 200


def convert_pdf_to_images(
    case_id: str,
    file_name: str,
    document_id: int | None = None,
) -> list[Path]:
    from pdf2image import convert_from_path, pdfinfo_from_path
    from app.services.progress_store import set_stage_progress

    STAGE = "converting_pdf"
    pdf_path  = PDF_UPLOAD_DIR / case_id / file_name
    pages_dir = PDF_UPLOAD_DIR / case_id / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    poppler_path = _POPPLER_PATH

    total_pages = 0
    try:
        info = pdfinfo_from_path(str(pdf_path), poppler_path=poppler_path)
        total_pages = int(info["Pages"])
        logger.info(f"[doc={document_id}] PDF has {total_pages} pages")
    except Exception as exc:
        logger.warning(f"[doc={document_id}] pdfinfo failed: {exc}")

    if document_id is not None:
        set_stage_progress(document_id, STAGE, 0, total_pages or 1, "pages")

    logger.info(
        f"[doc={document_id}] Converting '{pdf_path.name}' "
        f"at {_DPI} DPI in batches of {_CONVERT_BATCH}"
    )

    image_paths: list[Path] = []

    if total_pages:
        # Known page count → batched conversion (few subprocess calls)
        for batch_start in range(1, total_pages + 1, _CONVERT_BATCH):
            batch_end = min(batch_start + _CONVERT_BATCH - 1, total_pages)
            logger.info(
                f"[doc={document_id}] Converting pages {batch_start}–{batch_end}"
            )
            images = convert_from_path(
                str(pdf_path),
                dpi=_DPI,
                first_page=batch_start,
                last_page=batch_end,
                poppler_path=poppler_path,
            )
            for i, img in enumerate(images):
                page_num = batch_start + i
                img_path = pages_dir / f"page_{page_num}.png"
                img.save(str(img_path), "PNG")
                image_paths.append(img_path)
                if document_id is not None:
                    set_stage_progress(document_id, STAGE, page_num, total_pages, "pages")
    else:
        # Unknown page count → fall back to per-page loop
        page_num = 1
        while True:
            images = convert_from_path(
                str(pdf_path),
                dpi=_DPI,
                first_page=page_num,
                last_page=page_num,
                poppler_path=poppler_path,
            )
            if not images:
                break
            img_path = pages_dir / f"page_{page_num}.png"
            images[0].save(str(img_path), "PNG")
            image_paths.append(img_path)
            if document_id is not None:
                set_stage_progress(document_id, STAGE, page_num, page_num, "pages")
            page_num += 1

    logger.info(f"[doc={document_id}] Conversion done — {len(image_paths)} pages")
    return image_paths


def delete_page_images(case_id: str, document_id: int | None = None) -> int:
    """Delete all page PNG files for a case after OCR is complete.

    Returns number of files deleted.
    """
    pages_dir = PDF_UPLOAD_DIR / case_id / "pages"
    if not pages_dir.exists():
        return 0
    deleted = 0
    for png in pages_dir.glob("page_*.png"):
        try:
            png.unlink()
            deleted += 1
        except Exception as exc:
            logger.warning(f"[doc={document_id}] Could not delete {png.name}: {exc}")
    logger.info(f"[doc={document_id}] Deleted {deleted} page image(s) from {pages_dir}")
    return deleted
