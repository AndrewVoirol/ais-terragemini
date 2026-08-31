# Project: TerraGemini Holographic WebGL Cartography Elevation

## Architecture
TerraGemini is an interactive, browser-based WebGL holographic planetary cartography and tactical telemetry system. It combines raw WebGL/GLSL shader rendering with React 19, TypeScript, and Tailwind CSS.

### System Architecture & Data Flow
```
                                ┌────────────────────────────────────────┐
                                │             User / Pointer             │
                                └──────────────────┬─────────────────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ React Application Context (`App.tsx`) [DONE]                                                         │
│                                                                                                      │
│   ┌───────────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────────┐   │
│   │ Floating Control HUD      │      │ Tactical Overlay Reticle │      │ Target Visualizer HUD   │   │
│   │ (`ControlDeck.tsx`) [DONE]│      │ (`TacticalOverlay.tsx`)[DONE]│  │ (`TargetVisualizer.tsx`)[DONE]│
│   │ - Point Density (50k-250k)│      │ - 3D Tracking Reticle    │      │ - MGRS / DD / DMS / UTM │   │
│   │ - Solar Angle (0°-360°)   │      │ - Radar Lock Rings       │      │ - Elevation Telemetry   │   │
│   │ - 4 Colorway Presets      │      │ - Hover Crosshair        │      │ - Sector Grid Codes     │   │
│   │ - Sobel Edge Sensitivity  │      │ - SVG Dynamic Leader     │      │ - Target Lock States    │   │
│   │ - Orbit / Friction Tuning │      └───────────▲──────────────┘      └───────────▲─────────────┘   │
│   └─────────────┬─────────────┘                  │                                 │                 │
│                 │                                │ (Screen Coordinates)            │                 │
│                 ▼                                │                                 │                 │
│   ┌──────────────────────────────────────────────┴─────────────────────────────────┴─────────────┐   │
│   │ `RotatingEarth.tsx` (Modular, Self-Contained WebGL Canvas) [DONE]                           │   │
│   │                                                                                              │   │
│   │   ┌────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐   │   │
│   │   │ Pre-Ranked Point Cloud │  │ Ocean Specular Mesh     │  │ Graticule & Markers         │   │   │
│   │   │ 250k Points Array      │  │ Blinn-Phong Glint       │  │ Raycasted Screen Pick       │   │   │
│   │   │ Dynamic Range Draw     │  │ Solar Uniform Vector    │  │ Pointer Capture API         │   │   │
│   │   └────────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘   │   │
│   │                                                                                              │   │
│   │   ┌────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐   │   │
│   │   │ 4 Colorway Uniforms    │  │ Sobel Edge Convolution  │  │ Lifecycle & Context Manager │   │   │
│   │   │ Zero-Recompile Lerp    │  │ 3x3 Gradient Kernel     │  │ ResizeObserver / Disposal   │   │   │
│   │   └────────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘   │   │
│   └──────────────────────────────────────────────┬───────────────────────────────────────────────┘   │
│                                                  │                                                   │
│   ┌──────────────────────────────────────────────┴───────────────────────────────────────────────┐   │
│   │ Math & Coordinate Engines (`utils/`) [DONE]                                                  │   │
│   │ - `coordinates.ts`: WGS84 -> MGRS (1m precision), UTM, DD, DMS formatters                   │   │
│   │ - `projection.ts`: Screen-to-Sphere Raycasting & 3D-to-Screen Forward Projection            │   │
│   │ - `elevation.ts`: Topographic classification & normalized altitude estimation                │   │
│   └──────────────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Coordinate Math Engine | WGS84 to MGRS, UTM, DD, DMS conversion algorithms | M1 [DONE] | ORIGINAL_REQUEST §R2 |
| 2 | 3D Projection Engine | Screen-to-Sphere raycasting and forward Sphere-to-Screen projection | M1 [DONE] | ORIGINAL_REQUEST §R2 |
| 3 | Topographic Elevation Model | Normalized terrain elevation and land/ocean classification | M1 [DONE] | ORIGINAL_REQUEST §R2 |
| 4 | Pre-Ranked Point Cloud Buffer | 50k-250k dynamic scaling with zero CPU re-rasterization | M2 [DONE] | ORIGINAL_REQUEST §R1 |
| 5 | Blinn-Phong Ocean Specular Glide | 2K specular reflection glide driven by scrubbable sun vector | M2 [DONE] | ORIGINAL_REQUEST §R1 |
| 6 | 4 Colorway Preset Uniform Engine | Instant zero-recompile switching (Night Radar, Day Sat, Cyber Cyan, Gold) | M2 [DONE] | ORIGINAL_REQUEST §R1 |
| 7 | Sobel Coastline Convolution | 3x3 normal gradient edge sensitivity thresholding | M2 [DONE] | ORIGINAL_REQUEST §R1 |
| 8 | Damped Drag Physics & Auto-Orbit | Inertia momentum decay with toggleable auto-rotation | M2 [DONE] | ORIGINAL_REQUEST §R1 |
| 9 | Standalone Modular Architecture | Zero global window leaks, ResizeObserver, context loss recovery, clean disposal | M2 [DONE] | ORIGINAL_REQUEST §R3 |
| 10 | Live Hover Telemetry | Continuous screen cursor raycast readout (Lat/Lon/Elevation/Sector) | M3 [DONE] | ORIGINAL_REQUEST §R2 |
| 11 | 3D Target Reticle & Lock Rings | Target lock rings tracking geographic surface during 360° globe spin | M3 [DONE] | ORIGINAL_REQUEST §R2 |
| 12 | Tactical Telemetry HUD Card | MGRS / DD / DMS / UTM toggling, elevation readout, coordinate formatting | M3 [DONE] | ORIGINAL_REQUEST §R2 |
| 13 | Floating Glassmorphic Control HUD | Interactive real-time sliders for density, solar angle, palettes, Sobel, physics | M3 [DONE] | ORIGINAL_REQUEST §R1 |
| 14 | 60fps Showcase Video (`demo.mp4`) | Full showcase video in `deliverables/demo.mp4` (H.264, 60fps) | M4 [DONE] | ORIGINAL_REQUEST §R4 |
| 15 | Hero Animated WebP (`demo.webp`) | <5MB smooth looping animated WebP in `screenshots/demo.webp` | M4 [DONE] | ORIGINAL_REQUEST §R4 |
| 16 | 4 Hero Screenshots | `night-mode.png`, `day-specular.png`, `target-hud.png`, `palette-matrix.png` | M4 [DONE] | ORIGINAL_REQUEST §R4 |
| 17 | Showcase Portfolio README | Sacred Quick Start (≤4 cmds), tech stack table, deep WebGL shader breakdown | M5 [DONE] | ORIGINAL_REQUEST §R5 |
| 18 | Site Ingestion Package (`DELIVERABLES.md`) | Atomic build logs & Next.js drop-in guide for `andrewvoirol.com` / `ableandrew` | M5 [DONE] | ORIGINAL_REQUEST §R6 |
| 19 | 4-Tier E2E Test Suite | Automated opaque-box validation (Tiers 1-4) covering all features | E2E Track [DONE] | ORIGINAL_REQUEST §Acceptance |
| 20 | Adversarial Coverage Hardening | White-box stress tests & edge-case coverage hardening (Tier 5) | M6 [DONE] | ORIGINAL_REQUEST §Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite Track | Vitest + Playwright 4-tier test harness (Tiers 1–4) covering R1–R6 | none | DONE |
| M1 | Core Math & Coordinate Engines | `utils/coordinates.ts`, `utils/projection.ts`, `utils/elevation.ts`, `types.ts` | none | DONE |
| M2 | WebGL Core & Shader Pipeline Refactor | `components/RotatingEarth.tsx` (50k-250k points, Blinn-Phong specular, 4 palettes, Sobel, physics, lifecycle) | M1 | DONE |
| M3 | Tactical Telemetry & Control Deck UI | `components/TargetVisualizer.tsx`, `components/TacticalOverlay.tsx`, `components/ControlDeck.tsx`, `App.tsx` | M1, M2 | DONE |
| M4 | Studio Media & Deliverables Suite | `deliverables/demo.mp4` (60fps), `screenshots/demo.webp` (<5MB), 4 hero PNGs | M2, M3 | DONE |
| M5 | Portfolio Documentation & Ingestion | `README.md` (sacred quick start, shader math), `DELIVERABLES.md` (atomic logs) | M2, M3, M4 | DONE |
| M6 | Final Verification & Adversarial Hardening | 100% E2E test pass (Tiers 1-4) + Tier 5 adversarial stress testing + Forensic Audit | E2E, M1-M5 | DONE |

## Interface Contracts

### `utils/coordinates.ts` ↔ UI Components
```ts
export function latLonToMGRS(lat: number, lon: number, precision?: number): string;
export function latLonToUTM(lat: number, lon: number): { zoneNumber: number; band: string; easting: number; northing: number };
export function latLonToDD(lat: number, lon: number): string;
export function latLonToDMS(lat: number, lon: number): string;
export function formatCoordinatesAll(lat: number, lon: number): FormattedCoordinates;
```

### `utils/projection.ts` ↔ `RotatingEarth.tsx` ↔ `TacticalOverlay.tsx`
```ts
export function unprojectScreenToSphere(
  screenX: number,
  screenY: number,
  rotation: [number, number],
  scale: number,
  center: { x: number; y: number }
): Coordinates | null;

export function projectSphereToScreen(
  lat: number,
  lon: number,
  rotation: [number, number],
  scale: number,
  center: { x: number; y: number },
  altitude?: number
): { x: number; y: number; depth: number; isVisible: boolean };
```

### `RotatingEarth.tsx` Component Props (R3 Contract)
```tsx
export interface RotatingEarthProps {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;

  // Shader Controls (R1)
  palette?: ColorwayPalette;
  pointDensity?: number;      // 50,000 to 250,000
  solarAngle?: number;        // 0 to 360 degrees
  edgeSensitivity?: number;   // 0.0 to 1.0

  // Physics & Navigation
  autoOrbit?: boolean;
  orbitSpeed?: number;
  dragFriction?: number;
  interactive?: boolean;

  // Selection & Telemetry (R2)
  selectedLocation?: Coordinates | null;
  onLocationSelect?: (coords: Coordinates) => void;
  onHoverChange?: (telemetry: HoverTelemetry | null) => void;
  onTargetScreenPosChange?: (screenPos: { x: number; y: number; depth: number; isVisible: boolean } | null) => void;
  onViewChange?: (view: { lat: number; lon: number; scale: number; fps: number }) => void;
  onReady?: () => void;
}
```

## Code Layout
- `types.ts` — Central TypeScript interfaces and data models.
- `utils/coordinates.ts` — Military MGRS, UTM, Decimal Degrees, DMS conversion routines.
- `utils/projection.ts` — 3D spherical raycasting and forward screen projections.
- `utils/elevation.ts` — Terrain elevation estimation and geographic landmask classification.
- `components/RotatingEarth.tsx` — Modular, self-contained WebGL holographic globe.
- `components/ControlDeck.tsx` — Glassmorphic real-time shader & rendering control deck.
- `components/TacticalOverlay.tsx` — 3D-tracked target reticle, radar rings & SVG dynamic leader line.
- `components/TargetVisualizer.tsx` — Tactical coordinate telemetry card with MGRS/DD switching.
- `components/ChatPanel.tsx` — Uplink intelligence and report generator.
- `App.tsx` — Root application container binding modules cleanly.
- `tests/` — 4-tier automated test suite (Tiers 1-4).
- `deliverables/demo.mp4` — 60fps showcase video.
- `screenshots/` — `demo.webp` hero and 4 hero showcase PNGs.
- `README.md` — Portfolio documentation.
- `DELIVERABLES.md` — Site ingestion package for `andrewvoirol.com` / `ableandrew`.
