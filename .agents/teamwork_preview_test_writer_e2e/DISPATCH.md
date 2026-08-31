## 2026-08-31T11:26:19Z
You are the Test Writer for the E2E Testing Track on the TerraGemini elevation project.

Your Working Directory: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_test_writer_e2e/
Project Root: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini
Original Request: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/ORIGINAL_REQUEST.md
Project Plan: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/PROJECT.md
Test Infra Plan: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/TEST_INFRA.md

FILE WRITE OWNERSHIP:
- You own: `tests/` directory (e.g. `tests/tier1-smoke.spec.ts`, `tests/tier2-math-controls.spec.ts`, `tests/tier3-component-lifecycle.spec.ts`, `tests/tier4-deliverables-media.spec.ts`), `vitest.config.ts`, `TEST_READY.md`, and your `.agents/` directory.
- You may update `package.json` with test scripts/dependencies if needed.
- You MUST NOT modify source code files in `components/`, `utils/`, or `App.tsx`.

TASK:
1. Read `/Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/ORIGINAL_REQUEST.md`, `PROJECT.md`, and `TEST_INFRA.md`.
2. Install vitest or set up the testing framework with npm as necessary.
3. Author the complete 4-Tier test suite:
   - `tests/tier1-smoke.spec.ts`: Tests DOM mounting, canvas presence, WebGL context acquisition, shader compilation without GL errors, and HUD initialization.
   - `tests/tier2-math-controls.spec.ts`: Tests WGS84 -> MGRS (NYC, Tokyo, Paris, equator, polar zones), UTM, DD, DMS coordinate accuracy, raycasting unproject/project roundtrips, and shader uniform updates (point density 50k-250k, sun angle 0°-360°, 4 palettes, Sobel sensitivity 0.0-1.0).
   - `tests/tier3-component-lifecycle.spec.ts`: Tests `RotatingEarth` component isolation, props updates, container resizing via ResizeObserver, event listener cleanup on unmount, and WebGL context loss handling.
   - `tests/tier4-deliverables-media.spec.ts`: Tests presence, validity, and non-emptiness of `deliverables/demo.mp4`, `screenshots/demo.webp`, 4 hero PNGs, `README.md` (leads with demo.webp, ≤4 quick start commands), and `DELIVERABLES.md` (atomic build logs).
4. Run the test suite (`npx vitest run` or `npm test`). Note which tests pass currently (e.g., initial unit tests once utils are added) and confirm the test runner executes without syntax/framework errors.
5. Create `TEST_READY.md` at project root summarizing the test suite, test runner commands, and coverage matrix per `PROJECT.md`.
6. Write a complete handoff report to `/Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_test_writer_e2e/handoff.md`.
7. Message back with completion status.
