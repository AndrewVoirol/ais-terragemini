## 2026-08-31T11:52:00Z
You are Worker 4 (Studio Media & Deliverables Suite) for Milestone 4 of the TerraGemini elevation project.

Your Working Directory: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_worker_m4/
Project Root: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini
Original Request: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/ORIGINAL_REQUEST.md
Project Plan: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/PROJECT.md
Survey 3 Report: /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_explorer_survey_3/handoff.md

FILE WRITE OWNERSHIP:
- You exclusively own: `deliverables/`, `screenshots/`, any media generation capture scripts (e.g. `scripts/capture-media.mjs` or in your `.agents/` directory), and your `.agents/` directory.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK:
Generate all required media assets for Requirement R4 adhering to Studio capture rules:
1. **WebGL Non-Headless Rule**:
   - Write a Node.js capture script using Playwright with SwiftShader (`chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })`) or dev server navigation.
   - Start the Vite dev server or capture against local build / dev URL (`http://localhost:3000` or free port).
2. **Generate the 4 Hero PNGs in `screenshots/`**:
   - `screenshots/night-mode.png`: 1920x1080 capture of the Night Radar colorway with crimson glow and radar sweep.
   - `screenshots/day-specular.png`: 1920x1080 capture of the Day Satellite colorway with solar ocean specular glare.
   - `screenshots/target-hud.png`: 1920x1080 capture of the Target Visualizer telemetry card, 3D target lock rings, and dynamic SVG leader line.
   - `screenshots/palette-matrix.png`: 1920x1080 2x2 composite screenshot showing all 4 palettes (Night Radar, Day Satellite, Cyber Cyan, Holographic Gold) assembled via ffmpeg or Playwright composite.
   - Verify that none of the screenshots are black or blank rectangles!
3. **Generate `deliverables/demo.mp4`**:
   - 60fps showcase video (H.264, 1920x1080, yuv420p) showing planetary orbit rotation, specular ocean reflection glide, palette switching, and target pin dropping.
   - Encode with `ffmpeg -framerate 60 -i ... -c:v libx264 -pix_fmt yuv420p -crf 20 deliverables/demo.mp4`.
4. **Generate `screenshots/demo.webp`**:
   - High-quality animated WebP (< 5MB, smooth looping, 800-1200px wide, ~15-20fps).
   - Encode with `ffmpeg` / `cwebp`.
5. **Validate Deliverables**:
   - Check file sizes, formats, headers (`ffprobe deliverables/demo.mp4`, `ls -lh screenshots/`), and verify non-empty visual content.
   - Run `npx vitest run tests/tier4-deliverables-media.spec.ts`.
6. Write your handoff report to `/Users/andrewvoirol/Antigravity/Projects/ais-terragemini/.agents/teamwork_preview_worker_m4/handoff.md` and message back.
