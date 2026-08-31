# Original User Request

## 2026-08-31T11:22:55Z

# Teamwork Project Prompt — Launched

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Full team

Elevate TerraGemini from a rescued AI Studio export into a flagship WebGL holographic cartography showcase featuring real-time shader controls, tactical telemetry overlays, modular React exportability, studio-grade media deliverables, and site ingestion packages for andrewvoirol.com (AbleAndrew).

Working directory: `/Users/andrewvoirol/Antigravity/Projects/ais-terragemini`
Integrity mode: demo

## Requirements

### R1. Interactive Shader & Lighting Control Deck
- Implement a floating glassmorphic Control HUD in `components/RotatingEarth.tsx` exposing real-time shader & rendering parameters:
  - **Point Cloud Density**: Dynamically adjustable from 50,000 to 250,000 points with smoothstep landmask thresholding.
  - **Solar Angle / Lighting**: Scrubbable sun position uniform updating the 2K specular reflection glide across ocean surfaces in real-time.
  - **Colorway Palettes**: Instant switching between 4 distinct visual presets:
    1. *Night Radar* (Crimson glow, obsidian oceans, high-contrast radar sweep)
    2. *Day Satellite* (Natural atmospheric limb scattering, vibrant specular oceans, true topography)
    3. *Cyber Cyan* (Tron-style holographic neon, tactical gridlines, bright cyan landmasses)
    4. *Holographic Gold* (Amber/gold vector aesthetic with warm atmospheric corona)
  - **Edge Convolution Sensitivity**: Real-time slider adjusting coastline Sobel filter / normal gradient thresholding.
  - **Rotation Physics**: Damped momentum drag physics with friction decay, plus toggleable auto-orbit speed controls.

### R2. Tactical Telemetry & Target Visualizer Overlay
- Enhance `components/TargetVisualizer.tsx` with precision military/sci-fi coordinate telemetry:
  - Real-time cursor hover readout (latitude, longitude, normalized elevation, bounding coordinates).
  - Raycasted / unprojected globe click interaction dropping animated radar target rings and locked telemetry cards.
  - Coordinate formatting with military MGRS / decimal-degree toggles.

### R3. Modular Standalone Component Architecture
- Refactor the raw WebGL rendering pipeline in `components/RotatingEarth.tsx` to be completely self-contained and modular:
  - Eliminate all hardcoded window/document globals.
  - Accept clean configuration props (initial palette, point density, interaction bindings, dimensions, telemetry callbacks).
  - Clean lifecycle management: robust WebGL context loss handling, resize observer cleanup, and zero memory leaks.
  - Ensure drop-in exportability for seamless embedding in `andrewvoirol.com` (repo `ableandrew` / `ableandrew-site`).

### R4. Studio Media & Deliverables Suite
- Adhere strictly to the `/studio` (Studio Orchestrator) workflow, WebGL non-headless capture guidelines, and Playwright execution pipeline to generate high-fidelity portfolio assets:
  - `deliverables/demo.mp4`: 60fps showcase video demonstrating orbit rotation, specular ocean glide, palette switching, and target marker drops.
  - `screenshots/demo.webp`: High-quality animated WebP (< 5MB, smooth loop) for README hero.
  - 4 distinct hero screenshots in `screenshots/`:
    - `screenshots/night-mode.png` (Night Radar colorway with crimson sweep)
    - `screenshots/day-specular.png` (Day Satellite with solar ocean glare)
    - `screenshots/target-hud.png` (Target Visualizer telemetry card & lock rings)
    - `screenshots/palette-matrix.png` (Side-by-side or composite showcase of all 4 palettes)

### R5. README & Showcase Documentation Upgrade
- Overhaul `README.md` adhering to portfolio documentation standards:
  - Lead directly with `screenshots/demo.webp` (hero animated media, no preliminary text).
  - Sacred Quick Start (≤4 commands: clone, cd, npm install, npm run dev).
  - Clean Tech Stack scan table (React 19, TypeScript, Raw WebGL / GLSL, Tailwind CSS, Vite).
  - Deep architectural breakdown of the 900+ line raw WebGL shader pipeline (vertex point generation, custom fragment specular highlights, Sobel edge filter, raycast projection).

### R6. Site Ingestion Package (`DELIVERABLES.md`)
- Author `DELIVERABLES.md` adhering to `proof-of-work-content-ops` and atomic content models for `andrewvoirol.com` (AbleAndrew):
  - Detailed atomic build logs (the shader architecture refactor, Blinn-Phong specular ocean reflection math, Sobel convolution kernels, GPU memory buffer strategy for 250k dynamic points).
  - Complete drop-in integration guide for embedding `RotatingEarth` as a standalone widget into `andrewvoirol.com`.

---

## Acceptance Criteria

### Interactive Shader & Rendering Controls
- [ ] Control HUD is accessible and responsive, updating WebGL uniforms without frame drops (maintaining 60 FPS).
- [ ] Point density slider scales dynamically between 50k and 250k points.
- [ ] Solar angle slider smoothly animates specular reflection across oceanic regions.
- [ ] All 4 colorway presets (Night Radar, Day Satellite, Cyber Cyan, Holographic Gold) apply instantly without shader re-compilation hitching.
- [ ] Sobel coastline edge sensitivity slider visibly alters boundary sharpness.
- [ ] Drag rotation features momentum damping and auto-orbit toggling.

### Tactical Target Overlay & Telemetry
- [ ] Hovering over the globe displays accurate Lat/Long and telemetry in real time.
- [ ] Clicking on the globe drops a target marker locked to geographic coordinates.
- [ ] Target markers correctly rotate with the globe in 3D spherical space.

### Component Portability & Clean Architecture
- [ ] `RotatingEarth.tsx` exports cleanly without external window dependencies or unmanaged event listeners.
- [ ] Vite production build (`npm run build`) passes with zero TypeScript or bundling errors.

### Deliverables & Media
- [ ] `deliverables/demo.mp4` exists, is valid H.264/MP4, and showcases interactive features.
- [ ] `screenshots/demo.webp` and the 4 hero PNGs exist in `screenshots/`, are visually distinct, and non-empty.
- [ ] `README.md` leads with `demo.webp`, contains ≤4 quick start commands, tech stack table, and shader architecture guide.
- [ ] `DELIVERABLES.md` is complete with atomic build logs ready for site ingestion into `andrewvoirol.com` / `ableandrew`.
