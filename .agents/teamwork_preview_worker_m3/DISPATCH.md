## 2026-08-31T11:45:12Z

<USER_REQUEST>
You are Worker 3 (Tactical Telemetry & Control Deck UI) for Milestone 3 of the TerraGemini elevation project.

Your Working Directory: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_worker_m3/
Project Root: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini
Original Request: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/ORIGINAL_REQUEST.md
Project Plan: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/PROJECT.md

FILE WRITE OWNERSHIP:
- You exclusively own: `components/ControlDeck.tsx`, `components/TacticalOverlay.tsx`, `components/TargetVisualizer.tsx`, `App.tsx`, and your `.agents/` directory.
- You can read all files, including `components/RotatingEarth.tsx`, `types.ts`, `utils/coordinates.ts`, `utils/projection.ts`, `utils/elevation.ts`, and `tests/`.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK:
Implement Milestone 3 to satisfy Requirements R1 & R2:
1. **Implement `components/ControlDeck.tsx`**:
   - Floating glassmorphic Control HUD exposing real-time shader & rendering parameters:
     - Point Cloud Density slider (50k to 250k points)
     - Solar Angle slider (0° to 360°) updating the ocean specular glint glide
     - 4 Colorway preset buttons: Night Radar, Day Satellite, Cyber Cyan, Holographic Gold
     - Coastline Sobel Edge Sensitivity slider (0.0 to 1.0)
     - Rotation Physics: Drag friction damping slider, Auto-Orbit toggle button, and Orbit Speed slider.
     - Collapsible / expandable floating glassmorphic deck with Lucide icons and sci-fi aesthetic.
2. **Implement `components/TacticalOverlay.tsx`**:
   - High-performance SVG/DOM overlay tracking 3D target coordinates:
     - Pinned target reticle at `(targetScreenPos.x, targetScreenPos.y)` that stays locked as the globe spins in 3D.
     - Concentric radar lock rings, rotating outer brackets, azimuth ticks, pulsing target lock indicator.
     - Occlusion handling: Dims/fades with horizon indicator when `depth <= 0`.
     - SVG dynamic leader line connecting target coordinate anchor to `TargetVisualizer` card.
     - Micro hover crosshair tracking cursor position over the globe.
3. **Overhaul `components/TargetVisualizer.tsx`**:
   - Precision military/sci-fi coordinate telemetry:
     - Real-time cursor hover readout (latitude, longitude, normalized elevation, terrain classification, sector code).
     - Segmented coordinate format toggle: `[ MGRS | DD | DMS | UTM ]` with instant reformatting via `utils/coordinates.ts`.
     - Raycasted locked target telemetry card with elevation readout (`ELEV: +1,842m` or `ABYSSAL PLAIN -8,477m`), target azimuth, distance, and lock state (`SEARCHING` -> `ACQUIRING` -> `LOCKED`).
4. **Update `App.tsx`**:
   - Wire all components (`RotatingEarth`, `ControlDeck`, `TacticalOverlay`, `TargetVisualizer`, `ChatPanel`) with shared state, clean callbacks (`onHoverChange`, `onTargetScreenPosChange`, `onLocationSelect`), and responsive layout.
5. **Verify with Tests**:
   - Run `npm test` (verify all test suites pass) and `npx tsc --noEmit`.
   - Ensure `npm run build` succeeds cleanly.
6. Write your handoff report to `/Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_worker_m3/handoff.md` and message back.
</USER_REQUEST>
