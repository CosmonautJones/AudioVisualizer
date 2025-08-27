#!/usr/bin/env python3
import os, sys, json, subprocess, datetime, pathlib

root = pathlib.Path.cwd()
logs = root / "docloud" / "logs"
logs.mkdir(parents=True, exist_ok=True)
ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")

tool_json = sys.stdin.read().strip()
# If your runtime passes TOOL_NAME and TARGET_PATH via env, grab them:
tool = os.environ.get("CLAUDE_TOOL","")
target = os.environ.get("CLAUDE_TARGET","")

# 1) Run typecheck if TS changed
changed_ts = target.endswith(".ts") or target.endswith(".tsx")
if changed_ts:
    tsc = subprocess.run(["npx","tsc","--noEmit"], capture_output=True, text=True)
    if tsc.returncode != 0:
        # Send blocking error back; Claude will fix
        sys.stderr.write(tsc.stdout + "\n" + tsc.stderr)
        sys.exit(2)

# 2) Append change summary
clog = logs / f"CHANGELOG-{ts}.md"
with clog.open("a") as f:
    f.write(f"# ChangeLog {ts}\n")
    f.write(f"- tool: {tool}\n- target: {target}\n")
    f.write("```\n")
    f.write(tool_json[:20000])  # truncate if huge
    f.write("\n```\n")

print("ok")
