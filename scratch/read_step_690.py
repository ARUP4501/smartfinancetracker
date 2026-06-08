import json

transcript_path = r"C:\Users\patro\.gemini\antigravity-ide\brain\721c5889-3093-43e4-85f4-13ed4b346e70\.system_generated\logs\transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        data = json.loads(line)
        step = data.get("step_index")
        if step == 690:
            print("Tool calls:", json.dumps(data.get("tool_calls"), indent=2))
            break
