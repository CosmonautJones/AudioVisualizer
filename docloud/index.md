# DoCloud - Project Memory & Documentation

## Table of Contents

### Tasks
- [Task tracking and feature PRDs](./tasks/)

### Notes  
- [Running engineering notes](./notes/)

### Decisions
- [Architecture Decision Records (ADRs)](./decisions/)

### Summaries
- [Session and daily recaps](./summaries/)

### Logs
- [Tool-call logs and change summaries](./logs/)

---

## Quick Navigation

**Current Project**: Audio Visualizer Enhanced Platform  
**Status**: Production Ready (MVP+ with advanced features)  
**Stack**: Vite + TypeScript + Web Audio API + Canvas 2D  
**Features**: 20+ visualization combinations, real-time effects, professional UI

## Memory Structure

This directory provides persistent context across Claude Code sessions:

- **tasks/**: Feature planning, PRDs, and execution logs
- **notes/**: Quick engineering insights and observations  
- **decisions/**: Important architectural and design decisions
- **summaries/**: High-level progress recaps
- **logs/**: Detailed activity history

## Usage

Reference any file using: `docloud/[category]/[filename].md`

Update this index when adding new documentation categories or major files.

# Audio Visualizer – Working Index

## Current Status - Enhanced Visualization Platform ✅
**Architecture**: Multi-modal audio visualizer with advanced effects  
**Performance**: 60fps across all 20+ visualization combinations  
**Systems**: ColorMapping (4 modes) + BarEffects (5 modes) + Mandala renderer  
**UI**: Glassmorphism interface with real-time mode switching  

### Active Development
- **Phase**: Architecture Enhancement Complete
- **Recent**: ColorMapping and BarEffects systems integrated
- **Next**: WebGL acceleration and effect combinations

## Specs & Plans
- /docloud/tasks/ (one file per feature/phase)

## Decisions (ADRs)
- [ADR-001: Renderer Architecture](./decisions/ADR-001-renderer-architecture.md) - Multi-renderer foundation
- [ADR-002: ColorMapping System](./decisions/ADR-002-color-mapping-system.md) - 4-mode color system
- [ADR-003: BarEffects Architecture](./decisions/ADR-003-bar-effects-architecture.md) - 5-mode effects system

## Recent Activity
### Latest Session (2025-08-27)
- [Integration Session Summary](./summaries/2025-08-27_session_integration.md) - ColorMapping + BarEffects systems
- [Mandala Session Summary](./summaries/2025-08-27_mandala-session.md) - Multi-renderer architecture

## Notes & Analysis
- [Performance Analysis](./logs/performance-baseline-2025-08-27_22-26.md) - 60fps benchmarks
- [UI Design Enhancements](./logs/ui-design-2025-08-27.md) - Glassmorphism interface

## Change History
- [Mode Switching Implementation](./logs/CHANGELOG-2025-08-27-controls-mode-switching.md)
- [Audio Engine Analysis](./logs/audio-analysis-20250827_172645.md)
- [Canvas Optimization](./logs/canvas-analysis-2025-08-27-163000.md)
