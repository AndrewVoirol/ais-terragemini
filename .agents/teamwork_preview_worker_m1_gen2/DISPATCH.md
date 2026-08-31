## 2026-08-31T11:33:37Z
You are Worker 1 (Remediation Iteration 2) for Milestone 1 of the TerraGemini elevation project.

Your Working Directory: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_worker_m1_gen2/
Project Root: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini
Original Request: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/ORIGINAL_REQUEST.md
Project Plan: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/PROJECT.md
Gate Status & Feedback: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_orchestrator_main/GATE_STATUS.md
Challenger 1 Report: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_challenger_m1_1/handoff.md
Challenger 2 Report: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_challenger_m1_2/handoff.md

FILE WRITE OWNERSHIP:
- You exclusively own: `utils/coordinates.ts`, `utils/projection.ts`, `utils/elevation.ts`, `types.ts`, `tests/tier2-math-controls.spec.ts`, and your `.agents/` directory.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK:
Remediate the confirmed defects from Iteration 1:
1. In `utils/coordinates.ts`:
   - Add finite number guards `if (!Number.isFinite(lat) || !Number.isFinite(lon))` to `latLonToMGRS`, `getSectorGridCode`, `latLonToUTM`, `latLonToDD`, `latLonToDMS` returning empty strings or safe fallback objects.
   - Fix MGRS 100k row letter offset for even UTM zones: In `latLonToMGRS` and `getSectorGridCode`, change `rowOffset = utm.zoneNumber % 2 === 0 ? 14 : 0;` to `rowOffset = utm.zoneNumber % 2 === 0 ? 5 : 0;` (DoD/NGA standard row offset is 5 for even zones, e.g. Washington DC 18S -> `18S UJ`, Sydney 56H -> `56H LH`, NYC 40.7128N, -74.006W -> `18T WL`).
   - Update `tests/tier2-math-controls.spec.ts` if NYC regex expects `18TWV` to expect `18TWL`.
2. In `utils/projection.ts`:
   - In `unprojectScreenToSphere`, guard `if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || !Number.isFinite(scale) || scale <= 0 || !Number.isFinite(rSq) || rSq > 1.0) return null;`.
3. In `utils/elevation.ts`:
   - Fix antimeridian wrapping in mountain and trench distance calculations: `let dLon = ((lon - region.peakLon + 540) % 360) - 180;` and for trench points `let dLon = ((lon - trench.lon + 540) % 360) - 180;`.
   - In `getEstimatedElevation`, evaluate oceanic trench bathymetry BEFORE or alongside landmask checking, and override `isLand = false` if coordinate is within an oceanic trench's radius of influence.
   - In `isGeographicLand`, refine North America bounding box to not misclassify Caribbean / Western Atlantic waters around Puerto Rico Trench (lat 19.7, lon -66.5) as land.
   - Split `European Alps & Caucasus` into `European Alps` (peak Mont Blanc 45.83°N, 6.86°E, 4808m) and `Caucasus Mountains` (peak Mount Elbrus 43.35°N, 42.44°E, 5642m).
4. Run all tests (`npx vitest run`, `npm test`, `npx tsc --noEmit`, and `npx tsx tests/m1-challenger-benchmarks.ts`). Ensure 100% pass rate.
5. Write your handoff report to `/Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_worker_m1_gen2/handoff.md` and message back.
