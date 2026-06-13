import os
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse


router = APIRouter(prefix="/stt", tags=["Speech Translation"])

UPLOAD_DIR = Path(os.getenv("AUDIO_STORAGE_PATH", Path(__file__).resolve().parents[2] / "storage" / "stt_uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

_transcriber = None
_processor = None
_init_error: Optional[str] = None


def _get_engine():
    global _transcriber, _processor, _init_error
    if _transcriber and _processor:
        return _transcriber, _processor

    try:
        from app.services.speech.audio_processor import AudioProcessor
        from app.services.speech.transcriber import VoskTranscriber

        _transcriber = VoskTranscriber()
        _processor = AudioProcessor()
        _init_error = None
        return _transcriber, _processor
    except Exception as exc:
        _init_error = str(exc)
        raise HTTPException(status_code=503, detail=f"Speech engine is not configured: {_init_error}") from exc


def _safe_filename(filename: str, fallback: str) -> str:
    suffix = Path(filename or fallback).suffix or Path(fallback).suffix or ".wav"
    stem = Path(filename or fallback).stem or Path(fallback).stem
    safe_stem = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in stem)[:60] or "upload"
    return f"{int(time.time() * 1000)}_{safe_stem}{suffix}"


def _result_payload(result: dict, **extra):
    return {
        "success": True,
        "text": result.get("text", ""),
        "original_text": result.get("original_text", ""),
        "segments": result.get("segments", []),
        "original_segments": result.get("original_segments", []),
        "language": result.get("language", ""),
        "language_name": result.get("language_name", ""),
        "detected_language": result.get("detected_language"),
        "detection_confidence": result.get("detection_confidence"),
        "target_language": result.get("target_language"),
        "target_language_name": result.get("target_language_name"),
        "task": result.get("task", "transcribe"),
        "processing_time": result.get("processing_time"),
        **extra,
    }


def _apply_diarization(processed_path: str, result: dict, language: str, task: str, target_language: str, num_speakers: int):
    from app.services.speech.diarizer import Diarizer
    from app.services.speech.sarvam_transcriber import SARVAM_LANGUAGE_MAP

    dia = Diarizer.get_instance()
    dia_segments, speaker_count = dia.diarize(processed_path, num_speakers=num_speakers if num_speakers > 0 else None)

    sarvam = _transcriber.sarvam
    is_auto = language == "auto"
    sarvam_lang = result.get("detected_language") if is_auto and result.get("detected_language") else SARVAM_LANGUAGE_MAP.get(language, "unknown")
    detected_lang = result.get("detected_language") if is_auto else None

    transcript_segments = []
    original_parts = []

    for index, segment in enumerate(dia_segments):
        if segment["end"] - segment["start"] < 0.3:
            continue

        wav_bytes = Diarizer.extract_segment_audio(processed_path, segment["start"], segment["end"])
        try:
            chunk = sarvam._transcribe_chunk(wav_bytes, sarvam_lang, with_punctuation=True)
            text = chunk.get("transcript", "").strip()
            if not detected_lang and is_auto and chunk.get("language_code"):
                detected_lang = chunk["language_code"]
        except Exception:
            text = ""

        if text and text != "(No speech detected)":
            original_parts.append(text)
            transcript_segments.append({
                "id": index,
                "start": segment["start"],
                "end": segment["end"],
                "speaker": segment["speaker"],
                "text": text,
            })

    if not transcript_segments:
        return result, speaker_count

    original_text = " ".join(original_parts)
    original_segments = [dict(segment) for segment in transcript_segments]

    if task == "translate" and target_language:
        source_language = result.get("language", language)
        source_bcp47 = SARVAM_LANGUAGE_MAP.get(source_language)
        target_bcp47 = SARVAM_LANGUAGE_MAP.get(target_language)

        translated_parts = []
        for segment in transcript_segments:
            translated = None
            if source_language != target_language:
                try:
                    from app.services.speech import indictrans_translator as it2
                    if it2.is_supported(source_language, target_language):
                        translated = it2.translate(segment["text"], source_language, target_language)
                except Exception:
                    translated = None

                if not translated and source_bcp47 and target_bcp47:
                    try:
                        import requests

                        response = requests.post(
                            "https://api.sarvam.ai/translate",
                            headers={
                                "api-subscription-key": sarvam.api_key,
                                "Content-Type": "application/json",
                            },
                            json={
                                "input": segment["text"],
                                "source_language_code": source_bcp47,
                                "target_language_code": target_bcp47,
                                "speaker_gender": "Male",
                                "mode": "formal",
                                "model": "mayura:v1",
                                "enable_preprocessing": True,
                            },
                            timeout=30,
                        )
                        if response.status_code == 200:
                            translated = response.json().get("translated_text", "").strip() or None
                    except Exception:
                        translated = None

            segment["original_text"] = segment["text"]
            segment["text"] = translated or segment["text"]
            translated_parts.append(segment["text"])

        result["text"] = " ".join(translated_parts)
        result["original_text"] = original_text
        result["original_segments"] = original_segments
        result["task"] = "translate"
        result["target_language"] = target_language
        result["target_language_name"] = sarvam._get_language_name(target_language)
    else:
        result["text"] = original_text

    result["segments"] = transcript_segments
    if detected_lang:
        short_code = sarvam._bcp47_to_short(detected_lang)
        result["detected_language"] = detected_lang
        result["language"] = short_code
        result["language_name"] = sarvam._get_language_name(short_code)

    return result, speaker_count


@router.get("/health")
async def speech_health():
    try:
        transcriber, _ = _get_engine()
        return {
            "status": "healthy",
            "service": "ACB Speech Translation",
            "model": "Sarvam AI",
            "model_loaded": transcriber.is_model_loaded(),
            "available_languages": transcriber.get_available_languages(),
        }
    except HTTPException:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "detail": _init_error or "Speech engine unavailable"},
        )


@router.get("/languages")
async def speech_languages():
    transcriber, _ = _get_engine()
    return {"languages": transcriber.get_available_languages()}


@router.post("/transcribe")
async def transcribe_media(
    file: UploadFile = File(...),
    language: str = Query(default="auto"),
    task: str = Query(default="transcribe"),
    target_language: str = Query(default="en"),
    diarize: bool = Query(default=False),
    num_speakers: int = Query(default=0),
):
    if task not in {"transcribe", "translate"}:
        raise HTTPException(status_code=400, detail="task must be 'transcribe' or 'translate'")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    transcriber, processor = _get_engine()
    start_time = time.time()
    permanent_path = UPLOAD_DIR / _safe_filename(file.filename, "recording.wav")
    processed_path: Optional[str] = None

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty media file")
        permanent_path.write_bytes(content)

        processed_path = processor.process_audio(str(permanent_path))
        initial_task = "transcribe" if diarize and task == "translate" else task
        result = transcriber.transcribe(
            processed_path,
            language=language,
            task=initial_task,
            target_language=target_language,
        )

        speaker_count = 0
        if diarize:
            try:
                result, speaker_count = _apply_diarization(
                    processed_path,
                    result,
                    language,
                    task,
                    target_language,
                    num_speakers,
                )
            except Exception as exc:
                if task == "translate":
                    result = transcriber.transcribe(
                        processed_path,
                        language=language,
                        task="translate",
                        target_language=target_language,
                    )
                result["diarization_warning"] = str(exc)

        return _result_payload(
            result,
            filename=file.filename,
            media_path=str(permanent_path),
            diarization=diarize,
            speaker_count=speaker_count,
            processing_time=round(time.time() - start_time, 2),
            diarization_warning=result.get("diarization_warning"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        if processed_path and os.path.exists(processed_path):
            try:
                os.remove(processed_path)
            except OSError:
                pass


@router.post("/transcribe-live")
async def transcribe_live(
    file: UploadFile = File(...),
    language: str = Query(default="auto"),
    task: str = Query(default="transcribe"),
    target_language: str = Query(default="en"),
):
    transcriber, processor = _get_engine()
    tmp_path = UPLOAD_DIR / _safe_filename(file.filename or "live.webm", "live.webm")
    processed_path: Optional[str] = None
    start_time = time.time()

    try:
        content = await file.read()
        if not content or len(content) < 500:
            return {"success": True, "text": "", "processing_time": 0}

        tmp_path.write_bytes(content)
        processed_path = processor.process_audio(str(tmp_path))
        result = transcriber.transcribe(
            processed_path,
            language=language,
            task=task if task in {"transcribe", "translate"} else "transcribe",
            target_language=target_language,
        )

        return _result_payload(result, processing_time=round(time.time() - start_time, 2))
    except Exception:
        return {"success": True, "text": "", "processing_time": 0}
    finally:
        for path in {str(tmp_path), processed_path}:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass
