import logging
import os
import ssl
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Disable SSL verification for PaddleOCR model downloads (Baidu CDN cert not trusted on Windows)
ssl._create_default_https_context = ssl._create_unverified_context
os.environ.setdefault("PYTHONHTTPSVERIFY", "0")

_ocr_engine: Any = None


def _get_ocr():
    global _ocr_engine
    if _ocr_engine is None:
        from paddleocr import PaddleOCR
        logger.info("Initialising PaddleOCR engine (first call — may take a moment)")
        _ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    return _ocr_engine


def extract_ocr_blocks(image_path: Path, page_number: int, document_id: int) -> list[dict]:
    """
    Run PaddleOCR on a single page image.
    Returns a list of dicts ready to insert into ocr_blocks table.
    """
    ocr = _get_ocr()
    result = ocr.ocr(str(image_path), cls=True)

    blocks: list[dict] = []
    if not result or not result[0]:
        logger.debug(f"  Page {page_number}: no OCR results")
        return blocks

    for line in result[0]:
        bbox_points: list[list[float]] = line[0]  # [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
        text: str = line[1][0]
        confidence: float = float(line[1][1])

        x1 = min(p[0] for p in bbox_points)
        y1 = min(p[1] for p in bbox_points)
        x2 = max(p[0] for p in bbox_points)
        y2 = max(p[1] for p in bbox_points)

        blocks.append({
            "document_id": document_id,
            "page_number": page_number,
            "text": text.strip(),
            "x": x1,
            "y": y1,
            "width": x2 - x1,
            "height": y2 - y1,
            "confidence": confidence,
        })

    logger.debug(f"  Page {page_number}: {len(blocks)} blocks extracted")
    return blocks
