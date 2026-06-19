def reconstruct_page_text(ocr_blocks: list[dict]) -> str:
    """
    Sort OCR blocks by y then x (reading order) and join into plain text.
    """
    sorted_blocks = sorted(ocr_blocks, key=lambda b: (b["y"], b["x"]))
    lines = [b["text"] for b in sorted_blocks if b["text"].strip()]
    return "\n".join(lines)
