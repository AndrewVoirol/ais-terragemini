# Challenger 2 Handoff Report — Milestone 1: Core Math & Coordinate Engine

**Milestone**: Milestone 1 (Core Math & Coordinate Engine)  
**Agent**: Challenger 2 (`teamwork_preview_challenger_m1_2`)  
**Verdict**: **`REJECT`**  
**Date**: 2026-08-31T11:33:00Z  

---

## 1. Observation

Empirical testing and mathematical stress-testing were executed against `utils/coordinates.ts`, `utils/projection.ts`, and `utils/elevation.ts` using two custom test harnesses:
- `tests/m1-challenger-benchmarks.ts` (Comprehensive 100k-iteration throughput, memory leak, and cartographic oracle suite)
- `tests/adversarial-milestone1.spec.ts` (Vitest adversarial verification suite)

### 1.1 Throughput and Memory Benchmark Observations
Executing `npx tsx tests/m1-challenger-benchmarks.ts` recorded the following metrics across 100,000 operations each:

| Subsystem / Function | Iterations | Measured Throughput | Target | Status |
|---|---|---|---|---|
| `latLonToMGRS` (10-digit 1m precision) | 100,000 | **4,408,928 ops/sec** (22.68 ms) | >50,000 ops/sec | **PASS (88x target)** |
| `latLonToUTM` (WGS84 ellipsoid) | 100,000 | **14,837,070 ops/sec** (6.74 ms) | >50,000 ops/sec | **PASS (296x target)** |
| `formatCoordinatesAll` (MGRS+UTM+DD+DMS) | 100,000 | **1,069,555 ops/sec** (93.50 ms) | >30,000 ops/sec | **PASS (35x target)** |
| `projectSphereToScreen` (Forward 3D) | 100,000 | **27,237,752 ops/sec** (3.67 ms) | >100,000 ops/sec | **PASS (272x target)** |
| `unprojectScreenToSphere` (Raycast Pick) | 100,000 | **24,495,545 ops/sec** (4.08 ms) | >100,000 ops/sec | **PASS (244x target)** |
| `getEstimatedElevation` (Terrain Model) | 100,000 | **3,213,303 ops/sec** (31.12 ms) | >50,000 ops/sec | **PASS (64x target)** |
| `classifyTerrain` (Topography) | 100,000 | **4,512,737 ops/sec** (22.16 ms) | >50,000 ops/sec | **PASS (90x target)** |

**Heap Memory Stability**: Over 500,000 consecutive conversions in 10 batches of 50,000, heap usage remained completely stable (`53.54 MB -> 52.15 MB -> 50.70 MB -> 48.99 MB`), confirming zero memory leaks or object accumulation.

### 1.2 Cartographic Precision and Correctness Defect Observations
Direct execution of canonical military cartographic vectors revealed three critical bugs:

#### Defect A: MGRS 100,000-Meter Row Letter Corruption in Even UTM Zones
- **File**: `utils/coordinates.ts:167` and `utils/coordinates.ts:271`
- **Verbatim Code**:
  ```ts
  const rowOffset = utm.zoneNumber % 2 === 0 ? 14 : 0;
  const rowIndex = (Math.floor((utm.northing % 2000000.0) / 100000.0) + rowOffset) % 20;
  const rowLetter = MGRS_ROW_LETTERS.charAt(rowIndex);
  ```
- **Observed Failures**:
  - Washington DC (UTM Zone 18 Even, 38.8895°N, 77.0353°W): `latLonToMGRS` produced `"18S UT 23478 06483"`. The official US DoD/NGA canonical MGRS coordinate is `"18S UJ 23478 06483"`.
  - Sydney Opera House (UTM Zone 56 Even, -33.8568°S, 151.2153°E): produced `"56H LS 34900 52288"` instead of canonical Australian military `"56H LH 34900 52288"`.
  - Sector grid codes also corrupted: `getSectorGridCode(38.8895, -77.0353)` returned `"SEC-18S-UT"` instead of `"SEC-18S-UJ"`.

#### Defect B: 1,331-Meter Discontinuous Elevation Cliff Across the Antimeridian (±180° Longitude)
- **File**: `utils/elevation.ts:299` and `utils/elevation.ts:330`
- **Verbatim Code**:
  ```ts
  const dLat = (lat - region.peakLat);
  const dLon = (lon - region.peakLon);
  const dist = Math.sqrt(dLat * dLat + dLon * dLon);
  ```
- **Observed Failure**:
  - Latitude -80.0°, Longitude -180.0°: `elevationMeters: 3577m` (`Antarctic Ice Sheet (HIGH_PLATEAU)`).
  - Latitude -80.0°, Longitude +180.0°: `elevationMeters: 2246m` (`Antarctic Ice Sheet (MOUNTAINS)`).
  - Discontinuity: A **1,331-meter vertical elevation step** on the exact same physical geographic meridian.

#### Defect C: Misclassification of Puerto Rico Trench as Terrestrial Land
- **File**: `utils/elevation.ts:174`
- **Verbatim Code**:
  ```ts
  // North America
  if (lat >= 14.0 && lat <= 72.0 && normalizedLon >= -168.0 && normalizedLon <= -52.0) {
  ```
- **Observed Failure**:
  - Puerto Rico Trench (lat 19.7°N, lon -66.5°W, deepest point in Atlantic Ocean at -8,376m depth) is located within the `lat in [14..72], lon in [-168..-52]` bounding box.
  - `isGeographicLand(19.7, -66.5)` returns `true`.
  - `getEstimatedElevation(19.7, -66.5)` calculates `elevationMeters: +206m` (`Terrestrial PLAINS`) instead of the true oceanic trench depth (-8,376m).

---

## 2. Logic Chain

1. **Premise 1 (MGRS Military Standard)**: DMA TM 8358.1 / US Army FM 3-25.26 dictates that MGRS 100,000-meter row identification letters follow a 20-letter cycle (`ABCDEFGHJKLMNPQRSTUV`). In odd UTM zones, the row letter starts at `A` (index 0) at the equator. In even UTM zones, the row letter starts at `F` (index 5) at the equator.
2. **Inference 1**: `utils/coordinates.ts:167` hardcodes `rowOffset = 14` for even zones (corresponding to letter 'Q'). This introduces an erroneous +9-letter shift modulo 20 for all even UTM zones (covering 50% of the planet). Consequently, canonical coordinates for Washington DC, Tokyo, Sydney, etc. are corrupted.
3. **Premise 2 (Planetary Elevation Continuity)**: A planetary elevation model on a sphere must be continuous across the antimeridian ($\lambda = -180^\circ \equiv +180^\circ$).
4. **Inference 2**: In `utils/elevation.ts:299`, distance to mountain/trench peaks is computed using un-wrapped linear subtraction `dLon = lon - region.peakLon`. For Antarctic Ice Sheet (`peakLon = -85.5833`), when `lon = -180`, $\Delta \text{lon} = -94.42^\circ$; when `lon = +180`, $\Delta \text{lon} = +265.58^\circ$. This artificial distance inflation collapses proximity to 0 at $+180^\circ$, creating a 1,331m discontinuous cliff.
5. **Premise 3 (Bathymetric Consistency)**: `MAJOR_OCEANIC_TRENCHES` explicitly defines the Puerto Rico Trench with `depthMeters: -8376`.
6. **Inference 3**: Because `isGeographicLand` unconditionally classifies all coordinates in `lat: [14..72], lon: [-168..-52]` as North America land without excluding Caribbean/Atlantic waters, the trench branch is bypassed and the deepest abyss in the Atlantic is rendered as a +206m land plain.

---

## 3. Caveats

- **Scope boundary**: This review evaluated Milestone 1 (`utils/coordinates.ts`, `utils/projection.ts`, `utils/elevation.ts`, `types.ts`). WebGL shader rendering (`components/RotatingEarth.tsx`) and UI overlays (`TargetVisualizer.tsx`) belong to Milestones 2 and 3 and were not evaluated for implementation code changes.
- **Assumptions**: Canonical military cartographic standards were evaluated against DMA TM 8358.1, NGA standardization documents, and WGS84 ellipsoidal geometry.

---

## 4. Conclusion

**Verdict: `REJECT`**

While execution throughput (>4.4M coordinate conversions/sec vs >50k target) and memory stability are exceptional, Milestone 1 must be rejected until the following three mathematical and cartographic defects are remediated:

### Required Remediations for Worker:
1. **Fix MGRS Row Letter Offset in `utils/coordinates.ts`**:
   - In `latLonToMGRS` (line 167) and `getSectorGridCode` (line 271), change:
     ```ts
     const rowOffset = utm.zoneNumber % 2 === 0 ? 5 : 0;
     ```
   - In `tests/tier2-math-controls.spec.ts:156`, update the test assertion for NYC from `18TWV` to `18TWL` (`/^18TWL/`).
2. **Fix Antimeridian Longitude Wrapping in `utils/elevation.ts`**:
   - In `getEstimatedElevation` (line 299) and trench bathymetry (line 330), wrap longitude deltas:
     ```ts
     let dLon = ((lon - region.peakLon + 540) % 360) - 180;
     ```
3. **Refine Landmask in `utils/elevation.ts`**:
   - In `isGeographicLand` (line 174), exclude oceanic waters east of Florida/Caribbean (e.g. `if (lat < 25.0 && normalizedLon > -80.0) return false;`) or check oceanic trench proximity before landmask gating.

---

## 5. Verification Method

To independently reproduce all observations and verify subsequent fixes:

```bash
# 1. Run the comprehensive Challenger 2 benchmark and precision oracle:
npx tsx tests/m1-challenger-benchmarks.ts

# 2. Run the Vitest adversarial test suite:
npx vitest run tests/adversarial-milestone1.spec.ts

# 3. Run the complete project test suite:
npm test
```

### Invalidation Conditions:
- MGRS conversions for Washington DC (38.8895, -77.0353) return `18S UJ` (not `18S UT`).
- Sydney (-33.8568, 151.2153) returns `56H LH` (not `56H LS`).
- Elevation difference between $\text{lat} = -80^\circ, \text{lon} = -180^\circ$ and $\text{lat} = -80^\circ, \text{lon} = +180^\circ$ is exactly `0m`.
- Puerto Rico Trench (19.7, -66.5) reports `isLand: false` and `elevationMeters < -6000m`.
- All vitest test files pass with 0 failures.
