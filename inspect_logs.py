import json
from pathlib import Path

log_path = Path("/home/ashish-ratna/.gemini/antigravity/brain/bcbe5ddd-e54b-476a-82ce-681a36b84658/.system_generated/logs/overview.txt")
lines = log_path.read_text().splitlines()

print(f"Total lines in overview.txt: {len(lines)}")
for idx, line in enumerate(lines):
    try:
        data = json.loads(line)
        content = data.get("content", "")
        # print first 100 characters and line index
        snippet = content[:150].replace('\n', ' ')
        print(f"[{idx}] Source: {data.get('source')} | Type: {data.get('type')} | Length: {len(content)} | Snippet: {snippet}")
        if "Pre-Trap Approvals and Registration" in content or "decision matrix" in content or "ho_memo_system_prompt" in content:
            print("  -> FOUND INTERESTING KEYWORD")
            # Write to a file
            output_file = Path(f"/home/ashish-ratna/ACB/ACB/extracted_content_{idx}.txt")
            output_file.write_text(content)
            print(f"  -> Written to {output_file}")
    except Exception as e:
        print(f"[{idx}] Error parsing line: {e}")
