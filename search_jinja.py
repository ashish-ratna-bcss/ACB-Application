import os
from pathlib import Path

gemini_dir = Path("/home/ashish-ratna/.gemini/antigravity")
print(f"Searching for 'Jinja' or 'skeleton' in {gemini_dir}")
for root, dirs, files in os.walk(gemini_dir):
    for file in files:
        if file.endswith((".txt", ".json", ".md")):
            path = Path(root) / file
            try:
                content = path.read_text(errors="ignore")
                if "jinja" in content.lower() or "skeleton" in content.lower():
                    print(f"MATCH: {path} (size: {path.stat().st_size})")
                    # print lines around match
                    lines = content.splitlines()
                    for idx, line in enumerate(lines):
                        if "jinja" in line.lower() or "skeleton" in line.lower():
                            print(f"  [{idx}]: {line[:120]}")
            except Exception as e:
                pass
