import logging
import os
import uuid

from app.config import EMBEDDING_DIM, OLLAMA_EMBED_MODEL, OLLAMA_TIMEOUT, OLLAMA_URL, QDRANT_COLLECTION, QDRANT_URL

logger = logging.getLogger(__name__)

CHUNK_SIZE    = 1500   # chars per chunk
CHUNK_OVERLAP = 200    # overlap between consecutive chunks
CHUNK_STEP    = CHUNK_SIZE - CHUNK_OVERLAP   # 1300


def _chunks(text: str) -> list[str]:
    if not text or not text.strip():
        return []
    if len(text) <= CHUNK_SIZE:
        return [text]
    result = []
    start = 0
    while start < len(text):
        result.append(text[start : start + CHUNK_SIZE])
        start += CHUNK_STEP
    return result


def store_subdoc_embeddings(
    extracted: list[tuple[dict, dict]],
    case_id: str,
    document_id: int,
    subdoc_ids: list[int] | None = None,
    progress_callback=None,
) -> None:
    try:
        import ollama
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct

        ollama_url  = os.getenv("OLLAMA_URL",          OLLAMA_URL)
        embed_model = os.getenv("OLLAMA_EMBED_MODEL",  OLLAMA_EMBED_MODEL)
        qdrant_url  = os.getenv("QDRANT_URL",          QDRANT_URL)

        timeout_str   = os.getenv("OLLAMA_TIMEOUT", str(OLLAMA_TIMEOUT) if OLLAMA_TIMEOUT else "None")
        timeout       = int(timeout_str) if timeout_str and timeout_str != "None" else None
        ollama_client = ollama.Client(host=ollama_url, timeout=timeout)
        qdrant        = QdrantClient(url=qdrant_url, timeout=5)
        _ensure_collection(qdrant)

        total  = len(extracted)
        points: list[PointStruct] = []

        for i, (subdoc_meta, content) in enumerate(extracted, start=1):
            sd_id       = subdoc_ids[i - 1] if subdoc_ids else None
            main_text   = content.get("main_content") or ""
            text_chunks = _chunks(main_text)

            # Shared context fields prepended to every chunk
            header = "\n".join(filter(None, [
                content.get("title"),
                content.get("subject"),
                content.get("executive_summary"),
                " ".join(content.get("key_findings") or []),
                " ".join(content.get("key_actions")  or []),
            ]))

            for chunk_idx, chunk_text in enumerate(text_chunks):
                embed_text = f"{header}\n{chunk_text}".strip()[:8000]

                if not embed_text:
                    logger.debug(f"Skipping empty chunk {chunk_idx} for sub-doc {sd_id}")
                    continue

                resp   = ollama_client.embeddings(model=embed_model, prompt=embed_text)
                vector = resp.embedding

                if not vector:
                    logger.warning(f"Ollama returned empty vector for chunk {chunk_idx} sub-doc {sd_id} — skipping")
                    continue

                points.append(PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "case_id":         case_id,
                        "document_id":     document_id,
                        "sub_document_id": sd_id,
                        "title":           subdoc_meta.get("title"),
                        "document_type":   subdoc_meta.get("document_type"),
                        "start_page":      subdoc_meta.get("start_page"),
                        "end_page":        subdoc_meta.get("end_page"),
                        "chunk_index":     chunk_idx,
                        "chunk_total":     len(text_chunks),
                    },
                ))

            if progress_callback:
                progress_callback(i, total)

        if points:
            qdrant.upsert(collection_name=QDRANT_COLLECTION, points=points)
            logger.info(f"Stored {len(points)} chunk-point(s) for {total} sub-doc(s) in Qdrant")

    except Exception as exc:
        logger.error(f"Embedding step failed — {exc}")
        raise


def _ensure_collection(qdrant) -> None:
    from qdrant_client.models import Distance, VectorParams
    try:
        qdrant.get_collection(QDRANT_COLLECTION)
    except Exception:
        qdrant.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )
        logger.info(f"Created Qdrant collection '{QDRANT_COLLECTION}'")
