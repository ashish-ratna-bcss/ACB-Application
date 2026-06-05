import logging

logger = logging.getLogger(__name__)


def merge_sections(batch_results: list[list[dict]]) -> list[dict]:
    """
    Flatten sections from all batches and merge consecutive sections
    that share the same title (i.e. a section continued across a batch boundary).
    """
    flat: list[dict] = []
    for batch in batch_results:
        flat.extend(batch)

    if not flat:
        return []

    merged: list[dict] = [flat[0].copy()]

    for section in flat[1:]:
        last = merged[-1]
        if _same_title(section["title"], last["title"]):
            # Merge into previous section
            last["end_page"] = section["end_page"]
            last["content"] = last["content"].rstrip() + "\n" + section["content"].lstrip()
            logger.debug(f"Merged continuation of section '{last['title']}'")
        else:
            merged.append(section.copy())

    logger.info(f"Merge result: {len(flat)} raw → {len(merged)} final section(s)")
    return merged


def _same_title(a: str, b: str) -> bool:
    return a.strip().lower() == b.strip().lower()
