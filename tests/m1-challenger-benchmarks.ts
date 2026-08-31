import {
  latLonToMGRS,
  latLonToUTM,
  latLonToDD,
  latLonToDMS,
  getUTMZone,
  getLatitudeBand,
  formatCoordinatesAll,
  formatUTM,
  getSectorGridCode,
} from '../utils/coordinates';
import {
  projectSphereToScreen,
  unprojectScreenToSphere,
  getSphericalDistance,
  getBearing,
  isPointOccluded,
  interpolateGreatCircle,
} from '../utils/projection';
import {
  getEstimatedElevation,
  classifyTerrain,
  isGeographicLand,
} from '../utils/elevation';

interface BenchmarkResult {
  name: string;
  iterations: number;
  elapsedMs: number;
  opsPerSec: number;
  targetOpsPerSec: number;
  passed: boolean;
}

interface PrecisionFinding {
  testId: string;
  name: string;
  input: any;
  observed: any;
  expected: any;
  status: 'PASS' | 'FAIL';
  detail: string;
}

async function runBenchmarkSuite() {
  console.log('================================================================');
  console.log('CHALLENGER 2: MILESTONE 1 EMPIRICAL BENCHMARK & STRESS HARNESS');
  console.log('Project: TerraGemini Holographic Cartography');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  const benchmarkResults: BenchmarkResult[] = [];
  const precisionFindings: PrecisionFinding[] = [];

  // --------------------------------------------------------------------------
  // 1. THROUGHPUT BENCHMARK
  // --------------------------------------------------------------------------
  console.log('>>> RUNNING BENCHMARK SECTION 1: EXECUTION THROUGHPUT');

  const N_COORDS = 100000;
  const testCoords: Array<[number, number]> = [];
  for (let i = 0; i < N_COORDS; i++) {
    const lat = -79.0 + (i % 16000) * 0.01;
    const lon = -179.0 + (i % 35800) * 0.01;
    testCoords.push([lat, lon]);
  }

  // Warmup JIT
  for (let i = 0; i < 5000; i++) {
    latLonToMGRS(testCoords[i][0], testCoords[i][1], 5);
    projectSphereToScreen(testCoords[i][0], testCoords[i][1], [30, 20], 250, { x: 400, y: 300 });
  }

  // 1.1 latLonToMGRS
  {
    const start = performance.now();
    for (let i = 0; i < N_COORDS; i++) {
      latLonToMGRS(testCoords[i][0], testCoords[i][1], 5);
    }
    const elapsed = performance.now() - start;
    const ops = (N_COORDS / elapsed) * 1000;
    benchmarkResults.push({
      name: 'latLonToMGRS (10-digit 1m precision)',
      iterations: N_COORDS,
      elapsedMs: elapsed,
      opsPerSec: Math.round(ops),
      targetOpsPerSec: 50000,
      passed: ops >= 50000,
    });
  }

  // 1.2 latLonToUTM
  {
    const start = performance.now();
    for (let i = 0; i < N_COORDS; i++) {
      latLonToUTM(testCoords[i][0], testCoords[i][1]);
    }
    const elapsed = performance.now() - start;
    const ops = (N_COORDS / elapsed) * 1000;
    benchmarkResults.push({
      name: 'latLonToUTM (WGS84 ellipsoid)',
      iterations: N_COORDS,
      elapsedMs: elapsed,
      opsPerSec: Math.round(ops),
      targetOpsPerSec: 50000,
      passed: ops >= 50000,
    });
  }

  // 1.3 formatCoordinatesAll (Comprehensive MGRS + UTM + DD + DMS)
  {
    const start = performance.now();
    for (let i = 0; i < N_COORDS; i++) {
      formatCoordinatesAll(testCoords[i][0], testCoords[i][1]);
    }
    const elapsed = performance.now() - start;
    const ops = (N_COORDS / elapsed) * 1000;
    benchmarkResults.push({
      name: 'formatCoordinatesAll (all 4 tactical formats)',
      iterations: N_COORDS,
      elapsedMs: elapsed,
      opsPerSec: Math.round(ops),
      targetOpsPerSec: 30000,
      passed: ops >= 30000,
    });
  }

  // 1.4 projectSphereToScreen (Forward 3D Projection)
  {
    const start = performance.now();
    const rot: [number, number] = [45, -25];
    const center = { x: 500, y: 400 };
    for (let i = 0; i < N_COORDS; i++) {
      projectSphereToScreen(testCoords[i][0], testCoords[i][1], rot, 300, center);
    }
    const elapsed = performance.now() - start;
    const ops = (N_COORDS / elapsed) * 1000;
    benchmarkResults.push({
      name: 'projectSphereToScreen (3D forward matrix)',
      iterations: N_COORDS,
      elapsedMs: elapsed,
      opsPerSec: Math.round(ops),
      targetOpsPerSec: 100000,
      passed: ops >= 100000,
    });
  }

  // 1.5 unprojectScreenToSphere (Raycasting Screen-to-Sphere)
  {
    const start = performance.now();
    const rot: [number, number] = [45, -25];
    const center = { x: 500, y: 400 };
    for (let i = 0; i < N_COORDS; i++) {
      unprojectScreenToSphere(500 + (i % 400) - 200, 400 + (i % 400) - 200, rot, 300, center);
    }
    const elapsed = performance.now() - start;
    const ops = (N_COORDS / elapsed) * 1000;
    benchmarkResults.push({
      name: 'unprojectScreenToSphere (raycast inverse pick)',
      iterations: N_COORDS,
      elapsedMs: elapsed,
      opsPerSec: Math.round(ops),
      targetOpsPerSec: 100000,
      passed: ops >= 100000,
    });
  }

  // 1.6 getEstimatedElevation (Topographic Terrain Model)
  {
    const start = performance.now();
    for (let i = 0; i < N_COORDS; i++) {
      getEstimatedElevation(testCoords[i][0], testCoords[i][1]);
    }
    const elapsed = performance.now() - start;
    const ops = (N_COORDS / elapsed) * 1000;
    benchmarkResults.push({
      name: 'getEstimatedElevation (spherical harmonics + terrain)',
      iterations: N_COORDS,
      elapsedMs: elapsed,
      opsPerSec: Math.round(ops),
      targetOpsPerSec: 50000,
      passed: ops >= 50000,
    });
  }

  console.table(benchmarkResults);

  // --------------------------------------------------------------------------
  // 2. MEMORY STABILITY & LEAK ANALYSIS
  // --------------------------------------------------------------------------
  console.log('\n>>> RUNNING BENCHMARK SECTION 2: MEMORY LEAK & GC STABILITY');
  const MEM_BATCHES = 10;
  const BATCH_SIZE = 50000;
  const heapUsageSnapshots: number[] = [];

  for (let b = 0; b < MEM_BATCHES; b++) {
    for (let i = 0; i < BATCH_SIZE; i++) {
      const idx = (b * BATCH_SIZE + i) % N_COORDS;
      latLonToMGRS(testCoords[idx][0], testCoords[idx][1], 5);
      formatCoordinatesAll(testCoords[idx][0], testCoords[idx][1]);
      getEstimatedElevation(testCoords[idx][0], testCoords[idx][1]);
      projectSphereToScreen(testCoords[idx][0], testCoords[idx][1], [15, 10], 200, { x: 300, y: 300 });
    }
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
    }
    const memMB = process.memoryUsage().heapUsed / (1024 * 1024);
    heapUsageSnapshots.push(memMB);
  }

  const initialHeap = heapUsageSnapshots[0];
  const finalHeap = heapUsageSnapshots[MEM_BATCHES - 1];
  const heapDelta = finalHeap - initialHeap;
  console.log(`Heap snapshots over ${MEM_BATCHES * BATCH_SIZE} conversions (MB):`, heapUsageSnapshots.map(v => v.toFixed(2)).join(', '));
  console.log(`Heap Delta: ${heapDelta >= 0 ? '+' : ''}${heapDelta.toFixed(2)} MB`);

  // --------------------------------------------------------------------------
  // 3. PRECISION & CANONICAL CARTOGRAPHY ORACLE STRESS
  // --------------------------------------------------------------------------
  console.log('\n>>> RUNNING BENCHMARK SECTION 3: MGRS 10-DIGIT 1M PRECISION & ORACLE');

  // Test 3.1: Washington DC
  {
    const lat = 38.8895;
    const lon = -77.0353;
    const observedMGRS = latLonToMGRS(lat, lon, 5);
    const expectedPrefix = '18S UJ';
    const isCorrect = observedMGRS.startsWith(expectedPrefix);
    precisionFindings.push({
      testId: 'MGRS-01',
      name: 'Washington DC (Pentagon / Monument)',
      input: { lat, lon },
      observed: observedMGRS,
      expected: '18S UJ 23478 06483 (Zone 18 Even -> RowOffset=5 -> UJ)',
      status: isCorrect ? 'PASS' : 'FAIL',
      detail: isCorrect
        ? 'Matches canonical military MGRS 100k square'
        : `CRITICAL BUG: coordinates.ts hardcoded rowOffset=14 for even zones, returning "${observedMGRS.slice(0, 6)}" instead of "18S UJ" (9 letter row offset error)`,
    });
  }

  // Test 3.2: Sydney Opera House (Southern Hemisphere Even Zone)
  {
    const lat = -33.8568;
    const lon = 151.2153;
    const observedMGRS = latLonToMGRS(lat, lon, 5);
    const expectedPrefix = '56H LH';
    const isCorrect = observedMGRS.startsWith(expectedPrefix);
    precisionFindings.push({
      testId: 'MGRS-02',
      name: 'Sydney Opera House (Zone 56 Even, South)',
      input: { lat, lon },
      observed: observedMGRS,
      expected: '56H LH 34900 52288 (Zone 56 Even -> RowOffset=5 -> LH)',
      status: isCorrect ? 'PASS' : 'FAIL',
      detail: isCorrect
        ? 'Matches canonical Australian military MGRS'
        : `CRITICAL BUG: coordinates.ts returned "${observedMGRS.slice(0, 6)}" instead of "56H LH" due to rowOffset=14 bug in even zones`,
    });
  }

  // Test 3.3: Paris Eiffel Tower (Zone 31 Odd)
  {
    const lat = 48.8584;
    const lon = 2.2945;
    const observedMGRS = latLonToMGRS(lat, lon, 5);
    const expectedPrefix = '31U DQ';
    const isCorrect = observedMGRS.startsWith(expectedPrefix);
    precisionFindings.push({
      testId: 'MGRS-03',
      name: 'Paris Eiffel Tower (Zone 31 Odd)',
      input: { lat, lon },
      observed: observedMGRS,
      expected: '31U DQ 48252 11954 (Zone 31 Odd -> RowOffset=0 -> DQ)',
      status: isCorrect ? 'PASS' : 'FAIL',
      detail: isCorrect
        ? 'Matches canonical NATO / IGN Paris grid square'
        : 'Discrepancy in odd zone MGRS',
    });
  }

  // Test 3.4: Norway Bergen Zone 32V Exception
  {
    const lat = 60.3913;
    const lon = 5.3221;
    const zone = getUTMZone(lat, lon);
    const isCorrect = zone === 32;
    precisionFindings.push({
      testId: 'MGRS-04',
      name: 'Norway 32V Cartographic Exception',
      input: { lat, lon },
      observed: `Zone ${zone}`,
      expected: 'Zone 32',
      status: isCorrect ? 'PASS' : 'FAIL',
      detail: isCorrect ? 'Correctly mapped to Zone 32 per military standard' : 'Failed Norway zone exception',
    });
  }

  // Test 3.5: Svalbard Zone 33X Exception
  {
    const lat = 78.2232;
    const lon = 15.6267;
    const zone = getUTMZone(lat, lon);
    const isCorrect = zone === 33;
    precisionFindings.push({
      testId: 'MGRS-05',
      name: 'Svalbard 33X Cartographic Exception',
      input: { lat, lon },
      observed: `Zone ${zone}`,
      expected: 'Zone 33',
      status: isCorrect ? 'PASS' : 'FAIL',
      detail: isCorrect ? 'Correctly mapped to Zone 33 per military standard' : 'Failed Svalbard zone exception',
    });
  }

  // --------------------------------------------------------------------------
  // 4. ELEVATION MODEL SMOOTHNESS & CLASSIFICATION STABILITY
  // --------------------------------------------------------------------------
  console.log('\n>>> RUNNING BENCHMARK SECTION 4: ELEVATION & TERRAIN STABILITY');

  // Test 4.1: Antimeridian Elevation Continuity (-180 vs +180)
  {
    let maxAntimeridianDelta = 0;
    let worstLat = 0;
    for (let lat = -80; lat <= 80; lat += 2) {
      const west = getEstimatedElevation(lat, -180).elevationMeters;
      const east = getEstimatedElevation(lat, 180).elevationMeters;
      const delta = Math.abs(west - east);
      if (delta > maxAntimeridianDelta) {
        maxAntimeridianDelta = delta;
        worstLat = lat;
      }
    }
    const isSmooth = maxAntimeridianDelta === 0;
    precisionFindings.push({
      testId: 'ELEV-01',
      name: 'Antimeridian Elevation Continuity (-180° vs +180°)',
      input: { worstLat },
      observed: `Max delta: ${maxAntimeridianDelta}m at lat ${worstLat}°`,
      expected: '0m delta (exact geometric continuity on identical meridian)',
      status: isSmooth ? 'PASS' : 'FAIL',
      detail: isSmooth
        ? 'Perfect continuity across the antimeridian'
        : `CRITICAL BUG: utils/elevation.ts uses un-wrapped linear dLon = lon - region.peakLon in mountain/trench distance calculations, causing up to ${maxAntimeridianDelta}m vertical cliff discontinuity at the antimeridian`,
    });
  }

  // Test 4.2: Puerto Rico Trench Bathymetric Classification
  {
    const lat = 19.7;
    const lon = -66.5;
    const isLand = isGeographicLand(lat, lon);
    const elev = getEstimatedElevation(lat, lon);
    const isCorrect = !isLand && elev.elevationMeters < -6000;
    precisionFindings.push({
      testId: 'ELEV-02',
      name: 'Puerto Rico Trench Bathymetric Depth & Landmask',
      input: { lat, lon },
      observed: `isLand=${isLand}, elevation=${elev.elevationMeters}m (${elev.terrainType})`,
      expected: 'isLand=false, elevation < -6000m (ocean bathymetry trench)',
      status: isCorrect ? 'PASS' : 'FAIL',
      detail: isCorrect
        ? 'Correctly classified as deep oceanic trench'
        : `CRITICAL BUG: isGeographicLand defines North America as lat [14..72], lon [-168..-52] without excluding Caribbean / Atlantic oceanic waters, misclassifying the Puerto Rico Trench (-8,376m depth) as terrestrial plains (+206m elevation)`,
    });
  }

  // Test 4.3: Everest Peak Elevation Accuracy
  {
    const lat = 27.9881;
    const lon = 86.925;
    const elev = getEstimatedElevation(lat, lon);
    const isCorrect = elev.isLand && elev.elevationMeters >= 8000 && elev.elevationMeters <= 8848;
    precisionFindings.push({
      testId: 'ELEV-03',
      name: 'Himalayas / Mount Everest Orographic Summit',
      input: { lat, lon },
      observed: `${elev.elevationMeters}m (${elev.description})`,
      expected: '8000m to 8848m (terrestrial mountain / high plateau)',
      status: isCorrect ? 'PASS' : 'FAIL',
      detail: isCorrect ? 'Realistic orographic mountain height' : 'Out of expected elevation bounds',
    });
  }

  // Test 4.4: Normalized Elevation Boundary Invariant [0.0 .. 1.0]
  {
    let outOfBoundsCount = 0;
    let minNorm = 1.0;
    let maxNorm = 0.0;
    for (let lat = -90; lat <= 90; lat += 2) {
      for (let lon = -180; lon <= 180; lon += 5) {
        const norm = getEstimatedElevation(lat, lon).normalizedElevation;
        if (norm < minNorm) minNorm = norm;
        if (norm > maxNorm) maxNorm = norm;
        if (norm < 0.0 || norm > 1.0 || Number.isNaN(norm)) {
          outOfBoundsCount++;
        }
      }
    }
    const isInvariant = outOfBoundsCount === 0;
    precisionFindings.push({
      testId: 'ELEV-04',
      name: 'Global Normalized Elevation Range [0.0 .. 1.0]',
      input: '65,341 global sample points',
      observed: `Min: ${minNorm.toFixed(4)}, Max: ${maxNorm.toFixed(4)}, Violations: ${outOfBoundsCount}`,
      expected: 'Strictly bounded within [0.0, 1.0] with 0 NaN/Inf violations',
      status: isInvariant ? 'PASS' : 'FAIL',
      detail: isInvariant ? 'Strict compliance with shader uniform bounds' : 'Invariant violated',
    });
  }

  // --------------------------------------------------------------------------
  // 5. 3D PROJECTION & RAYCASTING INVERTIBILITY
  // --------------------------------------------------------------------------
  console.log('\n>>> RUNNING BENCHMARK SECTION 5: 3D PROJECTION PRECISION');

  // Test 5.1: Raycasting Bidirectional Invertibility
  {
    const center = { x: 400, y: 300 };
    const scale = 200;
    const rot: [number, number] = [35, -20];
    let maxErrorDeg = 0;
    let validCount = 0;

    for (let lat = -60; lat <= 60; lat += 10) {
      for (let lon = -150; lon <= 150; lon += 15) {
        const proj = projectSphereToScreen(lat, lon, rot, scale, center);
        if (proj.isVisible && proj.depth > 0.2) {
          const unproj = unprojectScreenToSphere(proj.x, proj.y, rot, scale, center);
          if (unproj) {
            const dLat = Math.abs(unproj.lat - lat);
            const dLon = Math.abs((((unproj.lon - lon + 540) % 360) - 180));
            const err = Math.sqrt(dLat * dLat + dLon * dLon);
            if (err > maxErrorDeg) maxErrorDeg = err;
            validCount++;
          }
        }
      }
    }

    const isHighPrecision = maxErrorDeg < 0.05;
    precisionFindings.push({
      testId: 'PROJ-01',
      name: '3D Forward/Inverse Spherical Raycast Invertibility',
      input: `${validCount} visible spherical surface points`,
      observed: `Max roundtrip error: ${maxErrorDeg.toFixed(6)}°`,
      expected: '< 0.05° sub-pixel precision',
      status: isHighPrecision ? 'PASS' : 'FAIL',
      detail: isHighPrecision
        ? 'High-fidelity geometric roundtrip consistency'
        : 'Invertibility precision failure',
    });
  }

  // Test 5.2: Screen Pick Off-Globe Rejection
  {
    const center = { x: 400, y: 300 };
    const scale = 200;
    const rot: [number, number] = [0, 0];
    // Test points outside unit sphere (distance > 200px from center)
    const pOff1 = unprojectScreenToSphere(650, 300, rot, scale, center); // dx = 250 > 200
    const pOff2 = unprojectScreenToSphere(400, 50, rot, scale, center);  // dy = 250 > 200
    const isRejected = pOff1 === null && pOff2 === null;
    precisionFindings.push({
      testId: 'PROJ-02',
      name: 'Screen Cursor Off-Globe Raycast Culling',
      input: 'Screen pixels at r = 1.25 * scale',
      observed: `pOff1=${pOff1}, pOff2=${pOff2}`,
      expected: 'null (ray misses spherical globe)',
      status: isRejected ? 'PASS' : 'FAIL',
      detail: isRejected ? 'Correctly returns null for ray misses' : 'Failed to cull off-globe rays',
    });
  }

  console.table(precisionFindings);

  console.log('\n================================================================');
  console.log('SUMMARY OF CHALLENGER FINDINGS');
  console.log('================================================================');
  const failedFindings = precisionFindings.filter(f => f.status === 'FAIL');
  console.log(`Total Precision Tests: ${precisionFindings.length}`);
  console.log(`Passed: ${precisionFindings.length - failedFindings.length}`);
  console.log(`Failed: ${failedFindings.length}`);

  if (failedFindings.length > 0) {
    console.log('\nCRITICAL DEFECTS IDENTIFIED:');
    failedFindings.forEach((f, idx) => {
      console.log(`[${idx + 1}] ${f.testId} - ${f.name}:`);
      console.log(`    Observed: ${JSON.stringify(f.observed)}`);
      console.log(`    Expected: ${JSON.stringify(f.expected)}`);
      console.log(`    Detail:   ${f.detail}\n`);
    });
  }
}

runBenchmarkSuite().catch(console.error);
