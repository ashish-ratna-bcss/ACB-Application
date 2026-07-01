import json
from pathlib import Path

log_path = Path("/home/ashish-ratna/.gemini/antigravity/brain/bcbe5ddd-e54b-476a-82ce-681a36b84658/.system_generated/logs/overview.txt")
lines = log_path.read_text().splitlines()

# Find the line that has "This flowchart represents"
for idx, line in enumerate(lines):
    if "This flowchart represents" in line:
        data = json.loads(line)
        output_file = Path("/home/ashish-ratna/ACB/ACB/extracted_user_request.txt")
        output_file.write_text(data["content"])
        print(f"Written user request to {output_file}")
        break
