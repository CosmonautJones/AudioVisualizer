#!/usr/bin/env python3
import datetime, pathlib, sys

root = pathlib.Path.cwd()
summ_dir = root / "docloud" / "summaries"
summ_dir.mkdir(parents=True, exist_ok=True)
repofile = summ_dir / (datetime.date.today().isoformat() + "_session.md")

with repofile.open("a") as f:
    f.write(f"\n---\n**Stopped {datetime.datetime.now().isoformat(timespec='seconds')}**\n")
print(str(repofile))
