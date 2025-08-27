Title: Audio-Visualizer MVP — One-Sweep Build Plan
Owner: Travis Jones
Agent: Claude Code (follow this document verbatim)

# Claude Contract — Read-First, Write-Back, Subagents

## Always Read-First (before any analysis or code change)
1) /docloud/index.md
2) The current task file under /docloud/tasks/*.md if one exists
3) The most recent recap in /docloud/summaries (session or daily)
4) For code edits: read target files AND /src/**/types.ts (if present)

If these files are missing, create them before proceeding.

## Always Write-Back (after each significant step)
- Append action logs, results, and next steps to the *current* task file under /docloud/tasks.
- If a session finishes or a phase completes, write a recap in /docloud/summaries/YYYY-MM-DD_session.md.
- If you make or revise a decision (e.g., fftSize range, perf guard), create or update an ADR in /docloud/decisions/ADR-###-slug.md.
- If you changed code, produce a short change log in /docloud/logs/CHANGELOG-<timestamp>.md.

## Subagents (Task Tool) Policy
- Use `task` subagents for: (a) large file scans, (b) parallel research, (c) CPU-bound analysis that would bloat the parent context.
- Parent agent only receives subagent *summaries*. Subagents must write their raw findings to /docloud/logs/* and link them in the task summary.

## Output Style
Prefer YAML or Table for structured responses; use HTML GenUI only when you need a guide or interactive doc. All structured outputs MUST include:
- `status: ok|blocked|needs-input`
- `inputs:` (what you assumed)
- `artifacts:` (files created/updated)
- `next:` (bullet list)

## Memory Guarantees
Treat the files under /docloud as canonical memory. Do not rely exclusively on chat memory. If you need context, search & read the relevant file(s) first.

## Tools & MCP
- If a filesystem MCP is available, you MUST use it for read/write to ensure deterministic FS operations.
- After file writes, run type checks and basic diagnostics (postToolUse hook will enforce this).


0) Mission & Definition of Done

Goal: Ship a minimal, smooth 60fps browser visualizer driven by the Web Audio API, with one page, one graph, one control panel.
Done when:

User can choose Mic or Audio File input.

Visual renders frequency bars on <canvas> at ≥ 55fps typical desktop.

Basic controls work: Input select, Sensitivity (gain), Bar count, Theme (light/dark), Pause/Resume.

Build runs with npm run dev and static export via npm run build served from dist/.

No console errors; Lighthouse Performance ≥ 90 local.

1) Constraints & Guardrails

Keep stack simple: Vite + TypeScript + Web Audio API + Canvas 2D (no React for MVP).

No persistence, no routing, no auth.

Accessibility: keyboard operable controls; high-contrast theme option.

Performance budget: main thread ≤ 8ms per frame.

Security: user-gesture required before mic capture; handle permission errors gracefully.

2) Architecture (MVP)
/src
  /audio
    audioEngine.ts      // getUserMedia/file input → AudioContext → AnalyserNode
    types.ts
  /viz
    renderer.ts         // canvas init & draw loop (requestAnimationFrame)
    themes.ts           // light/dark palettes
  /ui
    controls.ts         // wire up sliders, buttons, select
  main.ts               // bootstrap: wire audio ↔ viz ↔ ui
index.html              // canvas + control panel
styles.css              // minimal styling


Signal path: Input → GainNode(sensitivity) → AnalyserNode(fftSize configurable) → Uint8Array → renderer.drawBars().

3) Milestones (Claude, execute in order)

Scaffold

Init Vite TS: npm create vite@latest av-mvp -- --template vanilla-ts

Add minimal index.html, styles.css, main.ts.

Audio layer

Implement audioEngine.ts with:

initAudioFromMic() and initAudioFromFile(file: File)

setSensitivity(multiplier: number)

getFrequencyBinCount() & readFrequencyData(target: Uint8Array)

Renderer

renderer.ts: canvas sizing (devicePixelRatio aware), bar layout, frame loop, FPS guard (skip frame if > 12ms last paint).

UI controls

controls.ts: bind inputs; dispatch settings to audio/renderer; pause/resume toggle.

Glue

main.ts: boot sequence, permission prompts, fallback messages.

Perf & polish

Throttle resize, memo gradients, avoid GC in loop (reuse arrays), precompute bar x/width.

Build & verify

npm run dev, npm run build; serve dist and run quick Lighthouse.

4) Tasks & Acceptance Tests

T1 Scaffold → AT: npm run dev serves a blank page without errors.

T2 Mic input → AT: mic permission dialog; bars react to speaking.

T3 File input → AT: choose .mp3/.wav; playback + visualization sync.

T4 Controls → AT: sliders visibly change density/sensitivity; theme toggles; pause stops draw loop.

T5 Performance → AT: Chrome FPS meter ≈ 60; no allocations inside loop (Performance panel).

T6 Build → AT: dist/ works via static server; no console errors.

5) Implementation Notes

Use AnalyserNode.fftSize = 2048 by default; expose 512–4096 in UI.

Pre-allocate Uint8Array once: const bins = new Uint8Array(analyser.frequencyBinCount).

Device pixel ratio: canvas.width = clientWidth * dpr; canvas.height = clientHeight * dpr; ctx.scale(dpr, dpr).

Bars: map ~64–128 bars across width; average buckets from bins to bar count.

Avoid style/layout thrash: single ctx.fillRect loop; precomputed x/width.

Handle mic denial: show inline message and enable file fallback.

6) Commands Claude May Run

Safe reads/build: npm install, npm run dev, npm run build, npx tsc --noEmit, git status, git switch -c, git commit -m, git push (ask first).

Diagnostics: grep -n, cat, ls, mcp_ide_getDiagnostics, mcp_ide_applyEdit.

