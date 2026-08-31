# DISPATCH

## 2026-08-31T11:26:19Z

You are Worker 1 (Core Math & Coordinate Engine) for Milestone 1 of the TerraGemini elevation project.

Your Working Directory: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_worker_m1/
Project Root: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini
Original Request: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/ORIGINAL_REQUEST.md
Project Plan: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/PROJECT.md

FILE WRITE OWNERSHIP:
- You exclusively own: `types.ts`, `utils/coordinates.ts`, `utils/projection.ts`, `utils/elevation.ts`, and your `.agents/` directory.
- DO NOT modify `components/RotatingEarth.tsx` or `tests/` in this milestone.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK:
1. Read `/Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/ORIGINAL_REQUEST.md` and `PROJECT.md`.
2. Implement `types.ts` with all shared interfaces: `ColorwayPalette`, `CoordinateFormat`, `Coordinates`, `FormattedCoordinates`, `HoverTelemetry`, `TargetLock`, `RotatingEarthProps`, `PaletteConfig`.
3. Implement `utils/coordinates.ts`:
   - High-precision WGS84 to military MGRS (1m precision standard 10-digit MGRS, e.g. "18T WV 83959 07350" for NYC), UTM coordinates (Zone 1-60, Band C-X, Easting, Northing), Decimal Degrees (DD), and Degrees Minutes Seconds (DMS).
   - Format conversion helpers (`formatCoordinatesAll`, `formatMGRS`, `formatDD`, `formatDMS`, `formatUTM`).
4. Implement `utils/projection.ts`:
   - Screen-to-Sphere raycasting unprojection (`unprojectScreenToSphere`).
   - Forward Sphere-to-Screen projection (`projectSphereToScreen`) calculating `(screenX, screenY, depth, isVisible)` with rotation yaw/pitch, scale, and spherical depth occlusion.
5. Implement `utils/elevation.ts`:
   - Normalized terrain elevation estimator and geographic classification (`classifyTerrain`, `getEstimatedElevation`).
6. Verify code by running `npx tsc --noEmit` and executing node verification scripts to confirm coordinate precision against benchmarks (NYC, Tokyo, Paris, Sydney, Cairo).
7. Write a detailed handoff report to `/Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_worker_m1/handoff.md`.
8. Send a completion message back with the path to your handoff.
