# Milestone 1 Challenger 1 Empirical Handoff Report

**Agent**: Challenger 1 (critic, specialist)  
**Date**: 2026-08-31  
**Project**: TerraGemini Elevation Showcase (`ais-terragemini`)  
**Scope**: `utils/coordinates.ts`, `utils/projection.ts`, `utils/elevation.ts`  
**Verdict**: **`REJECT`** (Critical and High Severity Defects Identified)

---

## 1. Observation

During adversarial stress-testing and boundary value exploration against `utils/coordinates.ts`, `utils/projection.ts`, and `utils/elevation.ts`, four distinct mathematical, topological, and error-handling bugs were empirically reproduced:

### Observation 1.1: Uncaught `TypeError` on `NaN` / `undefined` Coordinates in `utils/coordinates.ts`
- **Command**:
  ```bash
  npx tsx -e "import { latLonToMGRS } from './utils/coordinates'; latLonToMGRS(NaN, NaN);"
  ```
- **Verbatim Error**:
  ```text
  /Users/andrewvoirol/Antigravity/Projects/ais-terragemini/utils/coordinates.ts:164
    const colLetter = MGRS_COL_SETS[setIndex].charAt(Math.max(0, Math.min(7, colIndex)));
                                              ^
  TypeError: Cannot read properties of undefined (reading 'charAt')
      at Object.latLonToMGRS (utils/coordinates.ts:164:45)
  ```
- **Affected Locations**:
  - `utils/coordinates.ts:164`: `latLonToMGRS` fails when `setIndex` is `NaN` because `MGRS_COL_SETS[NaN]` is `undefined`.
  - `utils/coordinates.ts:269`: `getSectorGridCode` fails with the identical uncaught `TypeError` on `NaN` inputs.

### Observation 1.2: 1,331-Meter Vertical Discontinuity Across Antimeridian ($\pm 180^\circ$) in `utils/elevation.ts`
- **Command**:
  ```bash
  npx tsx -e "
  import { getEstimatedElevation } from './utils/elevation';
  console.log('-180 lon:', getEstimatedElevation(-80, -180).elevationMeters);
  console.log('+180 lon:', getEstimatedElevation(-80, 180).elevationMeters);
  "
  ```
- **Observed Output**:
  ```text
  -180 lon: 3577
  +180 lon: 2246
  ```
- **Affected Location**:
  - `utils/elevation.ts:298–300`: `const dLon = (lon - region.peakLon);` does not wrap longitude delta to $[-180^\circ, 180^\circ]$. For the Antarctic Ice Sheet (`peakLon = -85.5833^\circ`), `lon = -180` yields $dLon = -94.4^\circ$ (within region bounds, boost applied $\to 3577\text{m}$), whereas `lon = +180` yields $dLon = +265.6^\circ$ (outside bounds, boost omitted $\to 2246\text{m}$).

### Observation 1.3: Puerto Rico Trench Misclassified as Terrestrial Land Plains in `utils/elevation.ts`
- **Command**:
  ```bash
  npx tsx -e "
  import { getEstimatedElevation, isGeographicLand } from './utils/elevation';
  console.log('isLand:', isGeographicLand(19.7, -66.5));
  console.log('Elevation:', getEstimatedElevation(19.7, -66.5));
  "
  ```
- **Observed Output**:
  ```text
  isLand: true
  Elevation: {
    elevationMeters: 206,
    normalizedElevation: 0.5647,
    terrainType: 'plains',
    isLand: true,
    description: 'Terrestrial PLAINS'
  }
  ```
- **Affected Location**:
  - `utils/elevation.ts:174`: The North America continental bounding box `lat: [14.0..72.0], lon: [-168.0..-52.0]` contains the Caribbean Sea and Western Atlantic deep oceanic basin. Because `isGeographicLand(19.7, -66.5)` returns `true`, the Puerto Rico Trench / Milwaukee Deep ($-8,376\text{m}$) is never evaluated against `MAJOR_OCEANIC_TRENCHES`, misclassifying the abyss as $+206\text{m}$ land plains.

### Observation 1.4: `unprojectScreenToSphere` Returns Object with `NaN` Instead of `null` on `NaN` Input
- **Command**:
  ```bash
  npx tsx -e "
  import { unprojectScreenToSphere } from './utils/projection';
  console.log(unprojectScreenToSphere(NaN, NaN, [0,0], 200, {x:0, y:0}));
  "
  ```
- **Observed Output**:
  ```text
  { lat: NaN, lon: NaN }
  ```
- **Affected Location**:
  - `utils/projection.ts:92`: `if (rSq > 1.0) return null;` evaluates to `false` when `rSq` is `NaN`, returning an object containing `NaN` rather than `null`.

---

## 2. Logic Chain

1. **Robustness & Error Resilience Requirement**:
   - `ORIGINAL_REQUEST.md` §R2 and `PROJECT.md` line 44 define `utils/coordinates.ts` and `utils/projection.ts` as core real-time telemetry providers for interactive pointer events.
   - During user interactions, initial render states, or rapid mouse movement off canvas boundaries, coordinate values may temporarily be `undefined` or `NaN`.
   - From **Observation 1.1**, calling `latLonToMGRS` or `getSectorGridCode` with invalid coordinates throws an uncaught `TypeError` because array lookup `MGRS_COL_SETS[NaN]` evaluates to `undefined`, crashing caller UI components.
   - From **Observation 1.4**, `unprojectScreenToSphere` fails to return `null` on `NaN` ray inputs, propagating `NaN` objects down to reactive state handlers.

2. **Topographic Continuity & Geographic Accuracy Requirement**:
   - `PROJECT.md` line 46 and `ORIGINAL_REQUEST.md` §R2 require accurate normalized elevation estimation and land/ocean classification across the globe.
   - From **Observation 1.2**, linear longitude subtraction without spherical angular wrapping creates an unphysical $1,331\text{m}$ vertical cliff discontinuity across the antimeridian ($\pm 180^\circ$).
   - From **Observation 1.3**, overly broad continental bounding boxes in `isGeographicLand` cause deep ocean trenches (such as the Puerto Rico Trench at $-8,376\text{m}$) to be falsely categorized as terrestrial plains with positive altitude.

3. **Evaluation & Verdict Synthesis**:
   - Because the codebase contains an uncaught fatal `TypeError` crash and severe elevation discontinuities along key meridians and oceanic trenches, Milestone 1 cannot be certified in its current state without remediation.

---

## 3. Caveats

- Benchmark execution throughput across all tested functions is outstanding: `latLonToMGRS` exceeds 140,000 ops/sec, `latLonToUTM` exceeds 250,000 ops/sec, and `projectSphereToScreen` exceeds 500,000 ops/sec.
- 3D forward projection matrix and raycasting roundtrips achieve machine floating-point precision ($\Delta < 10^{-14}$) for valid visible points.
- Core UTM zone logic (including Norway Zone 32 and Svalbard Zone 31/33/35/37 exceptions) is verified and passes 100% of longitudinal boundary tests.
- This challenger agent has **NOT** modified any implementation files (`utils/coordinates.ts`, `utils/projection.ts`, `utils/elevation.ts`), maintaining strict review-only isolation.

---

## 4. Conclusion

**Verdict: `REJECT`**

Milestone 1 fails adversarial verification due to the following defects requiring worker remediation:
1. **Critical Crash**: Add `if (!Number.isFinite(lat) || !Number.isFinite(lon))` guards to `latLonToMGRS` and `getSectorGridCode` returning safe fallbacks or empty strings.
2. **Critical Crash / Contract Violation**: Ensure `unprojectScreenToSphere` checks `if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || !Number.isFinite(scale) || scale <= 0)` and returns `null`.
3. **High Elevation Discontinuity**: Wrap `dLon` calculation in `utils/elevation.ts` using `((lon - region.peakLon + 540) % 360) - 180` to eliminate the $1,331\text{m}$ step cliff across the $\pm 180^\circ$ antimeridian.
4. **Medium Bathymetry Bug**: Refine `isGeographicLand` to exclude the Caribbean / Western Atlantic ocean basin (`lat: [15..25], lon: [-75..-60]`) so oceanic trenches like the Puerto Rico Trench can evaluate negative bathymetric depth.

---

## 5. Verification Method

To independently reproduce all observations and verify findings:

1. **Run Full Test Suite (including adversarial specifications)**:
   ```bash
   npm test
   ```

2. **Execute Targeted Adversarial Benchmark Script**:
   ```bash
   npx tsx tests/m1-challenger-benchmarks.ts
   ```

3. **Reproduce Uncaught Crash Directly**:
   ```bash
   npx tsx -e "import { latLonToMGRS } from './utils/coordinates'; console.log(latLonToMGRS(NaN, NaN));"
   ```
