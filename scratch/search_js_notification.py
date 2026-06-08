import json

transcript_path = r"C:\Users\patro\.gemini\antigravity-ide\brain\721c5889-3093-43e4-85f4-13ed4b346e70\.system_generated\logs\transcript.jsonl"

print("Searching transcript for app.js content containing notification or bell...")
with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        data = json.loads(line)
        content = str(data)
        if "app.js" in content and ("notification" in content.lower() or "bell" in content.lower()):
            print(f"Step {data.get('step_index')}: {data.get('type')}")
            idx = content.find("notification")
            if idx != -1:
                print("  Snippet:", content[max(0, idx-100):min(len(content), idx+100)])
