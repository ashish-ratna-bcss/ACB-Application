from pathlib import Path
import json

log_path = Path("/home/ashish-ratna/.gemini/antigravity/brain/bcbe5ddd-e54b-476a-82ce-681a36b84658/.system_generated/logs/overview.txt")
lines = log_path.read_text().splitlines()

for idx, line in enumerate(lines):
    if "perused the file" in line:
        print(f"Line {idx} matches:")
        try:
            data = json.loads(line)
            content = data.get("content", "")
            print(f"Index {idx} length: {len(content)}")
            # Let's search if the word "Jinja" or "Jinja2" is in the content
            print("Contains 'Jinja':", "Jinja" in content)
            print("Contains 'Jinja2':", "Jinja2" in content)
            # Write to a file
            output_file = Path(f"/home/ashish-ratna/ACB/ACB/full_line_{idx}.txt")
            output_file.write_text(content)
            print(f"Saved line {idx} content to {output_file}")
        except Exception as e:
            print(f"Error on line {idx}: {e}")
