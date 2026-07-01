from pathlib import Path
import json

log_path = Path("/home/ashish-ratna/.gemini/antigravity/brain/c2d483ab-89ba-49f0-90fb-c7045561a77d/.system_generated/logs/overview.txt")
lines = log_path.read_text(errors="ignore").splitlines()

print(f"Total lines: {len(lines)}")
for idx, line in enumerate(lines):
    if "jinja" in line.lower() or "perused the file" in line.lower():
        try:
            data = json.loads(line)
            content = data.get("content", "")
            print(f"[{idx}] Source: {data.get('source')} | Length: {len(content)}")
            # Write content of this line to a file
            output_file = Path(f"/home/ashish-ratna/ACB/ACB/matched_c2d4_line_{idx}.txt")
            output_file.write_text(content)
            print(f"  -> Saved to {output_file}")
        except Exception as e:
            # print first 200 chars if not json
            print(f"[{idx}] Not JSON (starts with {line[:100]}): {e}")
