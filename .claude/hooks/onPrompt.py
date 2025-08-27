#!/usr/bin/env python3
import os, sys, json, datetime, pathlib

root = pathlib.Path.cwd()
session = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
summ_dir = root / "docloud" / "summaries"
summ_dir.mkdir(parents=True, exist_ok=True)
logfile = summ_dir / (datetime.date.today().isoformat() + "_session.md")

payload = sys.stdin.read()
ts = datetime.datetime.now().isoformat(timespec="seconds")

with logfile.open("a") as f:
    f.write(f"\n### {ts} — PROMPT\n```\n{payload.strip()}\n```\n")
print("ok")
