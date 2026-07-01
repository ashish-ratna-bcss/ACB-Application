from pathlib import Path
import json

brain_root = Path("/home/ashish-ratna/.gemini/antigravity/brain")
print(f"Scanning directories in {brain_root}...")

matches = []
for p in brain_root.glob("**/logs/overview.txt"):
    try:
        content = p.read_text(errors="ignore")
        if "perused the file" in content or "ho_memo_system_prompt" in content or "instructed to register FIR" in content:
            # check if it is not the current active one, or if it is
            print(f"FOUND match in: {p}")
            matches.append(p)
    except Exception as e:
        pass

print(f"Found {len(matches)} files.")
for p in matches:
    # let's find the lines in this file that are not just the model thinking
    lines = p.read_text(errors="ignore").splitlines()
    for idx, line in enumerate(lines):
        if "perused the file" in line or "ho_memo_system_prompt" in line:
            try:
                data = json.loads(line)
                c = data.get("content", "")
                if len(c) > 1000 and data.get("source") == "USER_EXPLICIT":
                    print(f"  -> Match in {p.parent.parent.parent.name} line {idx} (len: {len(c)})")
                    # Save it!
                    out_path = Path(f"/home/ashish-ratna/ACB/ACB/full_untruncated_req_{p.parent.parent.parent.name}.txt")
                    out_path.write_text(c)
                    print(f"     Saved to {out_path}")
            except Exception as e:
                pass
