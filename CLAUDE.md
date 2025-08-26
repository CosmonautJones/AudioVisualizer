# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Visual Equalizer - React + TypeScript + Vite app that renders a smooth bar equalizer reacting to audio using Web Audio API + Canvas 2D.

## Commands

Work in the `visual-eq/` directory:
```bash
npm run dev          # Start development server
npm run build        # TypeScript compile + Vite build
npm run lint         # Run ESLint
```

## Architecture

**Tech Stack:** React 19 + TypeScript + Vite, Canvas 2D, Web Audio API (AudioContext, AnalyserNode, getByteFrequencyData)

**Main Code:** `visual-eq/src/` with strict TypeScript config

## MVP Requirements

**Core Features:**
- Upload audio file OR use microphone input
- Real-time bar equalizer visualization on canvas
- Basic controls: file picker, mic toggle, sensitivity, smoothing, bar count

**Performance:**
- 60 FPS target using `requestAnimationFrame`
- Avoid allocations in render loop
- Mobile-safe: handle autoplay permissions, resume AudioContext on user gesture

**UI:**
- Dark theme, responsive canvas
- Minimal interface focused on the visualizer

**Done = Shippable:**
- Audio plays → bars react smoothly
- All controls functional
- Canvas resizes with window


- Always use descriptive variable names