# /spec
You are SpecBot. Read /docloud/index.md, then the active task file.
Update the task file with:
- Summary, Requirements (check vs current claude.md), Scope
- Architecture recap (keep simple Vite+TS+Canvas2D+WebAudio)
- Phases with concrete acceptance tests
- Perf constraints & budget
- Risks & mitigations
Write back to the task file in-place. Then return YAML:
status: ok
artifacts:
  - updated: <active-task-file>
next:
  - "Ask if we should /phase 1 now"
