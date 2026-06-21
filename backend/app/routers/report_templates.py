"""Report template API — standardized ACB sub-document structures per workflow phase."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.database import SessionLocal
from app.services.report_templates import (
    PHASE_PANEL_META,
    get_all_templates,
    get_template_by_id,
    get_templates_for_phase,
)

router = APIRouter(prefix="/report-templates", tags=["report-templates"])


@router.get("", summary="List report templates")
def list_templates(
    phase: Optional[str] = Query(None),
    include_structure: bool = Query(False, alias="includeStructure"),
):
    db = SessionLocal()
    try:
        return get_all_templates(db, phase=phase, include_structure=include_structure)
    finally:
        db.close()


@router.get("/phases", summary="Phase panel metadata and template counts")
def list_phase_meta():
    db = SessionLocal()
    try:
        result = []
        for phase, meta in PHASE_PANEL_META.items():
            templates = get_templates_for_phase(db, phase)
            result.append({
                "phase": phase,
                "title": meta["title"],
                "description": meta["desc"],
                "templateCount": len(templates),
                "templates": [{"id": t["id"], "title": t["title"], "shortTitle": t["shortTitle"]} for t in templates],
            })
        return result
    finally:
        db.close()


@router.get("/by-phase/{phase}", summary="Templates for a workflow phase")
def templates_by_phase(phase: str, include_structure: bool = Query(True, alias="includeStructure")):
    db = SessionLocal()
    try:
        templates = get_templates_for_phase(db, phase, include_structure=include_structure)
        meta = PHASE_PANEL_META.get(phase, {"title": phase, "desc": ""})
        return {
            "phase": phase,
            "title": meta["title"],
            "description": meta["desc"],
            "templates": templates,
        }
    finally:
        db.close()


@router.get("/{template_id}", summary="Get a single report template with full structure")
def get_template(template_id: str):
    db = SessionLocal()
    try:
        tpl = get_template_by_id(db, template_id)
        if not tpl:
            raise HTTPException(status_code=404, detail="Template not found")
        return tpl
    finally:
        db.close()
