import os
from pathlib import Path

brain_root = Path("/home/ashish-ratna/.gemini/antigravity/brain")
print(f"Scanning for 'jinja' in all brain files...")
for p in brain_root.rglob("*"):
    if p.is_file() and p.suffix in (".txt", ".json", ".md"):
        try:
            content = p.read_text(errors="ignore")
            if "jinja" in content.lower():
                print(f"MATCH: {p} (size: {p.stat().st_size})")
        except Exception:
            pass
