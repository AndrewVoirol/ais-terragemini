# E2E Test Infra: TerraGemini Elevation

## Test Philosophy
- Opaque-box, requirement-driven testing. Derived from `ORIGINAL_REQUEST.md`.
- No reliance on internal implementation details — tests exercise components and UI via DOM events, canvas state, WebGL context inspection, file validation, and Playwright browser execution.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinations + Workload Testing.

## Feature Inventory
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|----------------------|:------:|:------:|:------:|:------:|
| 1 | WGS84 to MGRS/UTM/DD/DMS Math | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 2 | Screen Raycast & 3D Forward Projection | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 3 | Dynamic Point Cloud Scaling (50k-250k) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 4 | Blinn-Phong Specular Solar Glide | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 5 | 4 Colorway Preset Switching | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 6 | Sobel Coastline Convolution Sensitivity | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 7 | Inertia Drag Physics & Orbit Controls | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 8 | Tactical Hover Telemetry & Elevation | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 9 | Rotating 3D Target Reticle & Lock Rings | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 10 | Standalone Component Lifecycle & Disposal | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 11 | Studio Media Artifacts Validation | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |
| 12 | Portfolio README & Showcase Docs | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ | ✓ |
| 13 | Site Ingestion Package (DELIVERABLES.md) | ORIGINAL_REQUEST §R6 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Runner**: Vitest for unit/integration tests (`npm test` / `npx vitest run`), Playwright for visual/E2E tests (`npx playwright test`).
- **Test Matrix Layout**:
  - `tests/tier1-smoke.spec.ts` — DOM mounting, WebGL initialization, context stability, zero GL errors.
  - `tests/tier2-math-controls.spec.ts` — MGRS/UTM math accuracy, raycasting projection roundtrips, shader uniform updates (density, solar angle, palettes, Sobel).
  - `tests/tier3-component-lifecycle.spec.ts` — Modular isolation, container resizing via ResizeObserver, zero dangling event listeners, context loss handling, clean disposal.
  - `tests/tier4-deliverables-media.spec.ts` — Studio media validation (`deliverables/demo.mp4`, `screenshots/demo.webp`, 4 hero PNGs), README quick start format, `DELIVERABLES.md` atomic build logs.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Global Tactical Reconnaissance | Point scaling, Cyber Cyan palette, live hover telemetry, MGRS target pinning | High |
| 2 | Orbital Solar Specular Glide | Solar scrub, Day Satellite palette, specular glint, auto-orbit momentum | Medium |
| 3 | Maritime Boundary Sobel Analysis | Sobel edge sensitivity, Night Radar palette, high-contrast coastal filtering | High |
| 4 | Rapid Coordinate System Interop | MGRS $\leftrightarrow$ DD $\leftrightarrow$ DMS toggling, 3D target lock rings across 360° rotation | High |
| 5 | Standalone Widget Embedding & Resize | Sub-container embedding, ResizeObserver canvas resize, unmount memory disposal | High |

## Coverage Thresholds
- Tier 1: ≥5 smoke & context checks
- Tier 2: ≥5 assertions per interactive control & coordinate transform
- Tier 3: Pairwise coverage of component props, resize events, and lifecycle unmounts
- Tier 4: ≥5 real-world end-to-end integration and deliverable verification suites
