import os
from pathlib import Path

brain_root = Path("/home/ashish-ratna/.gemini/antigravity/brain")
for p in brain_root.rglob("*.txt"):
    if p.name == "overview.txt":
        try:
            content = p.read_text(errors="ignore")
            if "perused the file" in content or "ho_memo_system_prompt" in content:
                print(f"FOUND in {p}")
                # Save the full matching content to a file in ACB workspace
                out_path = Path("/home/ashish-ratna/ACB/ACB/found_full_prompt.txt")
                out_path.write_text(content)
                print(f"Saved full content to {out_path}")
        except Exception as e:
            print(f"Error reading {p}: {e}")
