# /phase
Param: <phase-number or name>
Steps:
1) Read /docloud/index.md and active task.
2) Summarize inputs & expected outcomes for this phase.
3) Execute with subagents when heavy scans/research needed.
4) Write artifacts + change log under /docloud/logs/ and append to task Execution Log.
5) If code changed, run diagnostics (typecheck/lint) and include results in log.
Return YAML with status, artifacts, next.
