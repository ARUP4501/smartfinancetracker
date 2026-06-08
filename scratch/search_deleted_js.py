import json
import sys

# Set standard output to UTF-8
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')

transcript_path = r"C:\Users\patro\.gemini\antigravity-ide\brain\721c5889-3093-43e4-85f4-13ed4b346e70\.system_generated\logs\transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        data = json.loads(line)
        content = str(data)
        if "app.js" in content and "notifications" in content:
            if "replace_file_content" in content or "multi_replace_file_content" in content:
                if "tool_calls" in data and data["tool_calls"]:
                    for tc in data["tool_calls"]:
                        if "replace" in tc["name"]:
                            print(f"Step {data.get('step_index')}: {tc['name']}")
                            print(tc["args"].get("ReplacementChunks") or tc["args"].get("ReplacementContent"))
                elif data.get("type") == "CODE_ACTION":
                    print(f"Step {data.get('step_index')}: CODE_ACTION")
                    print(str(data.get("content"))[:2000])
