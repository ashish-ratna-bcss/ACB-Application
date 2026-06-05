import json
import logging
from typing import TypedDict

from app.config import PDF_UPLOAD_DIR

logger = logging.getLogger(__name__)


class StageProgress(TypedDict):
    current: int
    total: int
    unit: str


# In-memory cache — fast reads for active pipelines
_progress: dict[int, dict[str, StageProgress]] = {}


def _progress_file(document_id: int):
    return PDF_UPLOAD_DIR / f"progress_{document_id}.json"


def set_stage_progress(
    document_id: int, stage: str, current: int, total: int, unit: str = ""
) -> None:
    if document_id not in _progress:
        _progress[document_id] = {}
    _progress[document_id][stage] = {"current": current, "total": total, "unit": unit}
    # Persist to disk so progress survives backend restart during long pipelines
    try:
        _progress_file(document_id).write_text(
            json.dumps(_progress[document_id]), encoding="utf-8"
        )
    except Exception as exc:
        logger.debug(f"Progress file write failed (non-fatal): {exc}")


def get_all_progress(document_id: int) -> dict[str, StageProgress]:
    if document_id in _progress:
        return _progress[document_id]
    # Cache miss — try file (covers restart scenario)
    f = _progress_file(document_id)
    if f.exists():
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            _progress[document_id] = data
            return data
        except Exception as exc:
            logger.debug(f"Progress file read failed: {exc}")
    return {}


def clear_progress(document_id: int) -> None:
    """Remove in-memory and on-disk progress when pipeline finishes."""
    _progress.pop(document_id, None)
    try:
        _progress_file(document_id).unlink(missing_ok=True)
    except Exception:
        pass
