import os
from pathlib import Path

gemini_dir = Path("/home/ashish-ratna/.gemini/antigravity")
print(f"Searching in {gemini_dir}")
found_files = []
for root, dirs, files in os.walk(gemini_dir):
    for file in files:
        if file.endswith((".txt", ".json", ".md")):
            path = Path(root) / file
            try:
                content = path.read_text(errors="ignore")
                if "perused the file" in content or "instructed to register FIR" in content:
                    print(f"FOUND matches in: {path} (size: {path.stat().st_size})")
                    found_files.append(path)
            except Exception as e:
                pass

if found_files:
    # let's write a summary or extract sections from the first one
    content = found_files[0].read_text(errors="ignore")
    # let's find the exact text containing "perused the file" and print it out
    idx = content.find("perused the file")
    print("\n--- Match Context ---")
    print(content[max(0, idx - 500): min(len(content), idx + 2000)])
else:
    print("No files found containing target phrases.")
