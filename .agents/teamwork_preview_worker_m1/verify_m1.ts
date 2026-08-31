import {
  latLonToUTM,
  latLonToMGRS,
  latLonToDD,
  latLonToDMS,
  formatCoordinatesAll,
  getSectorGridCode,
  getUTMZone,
  getLatitudeBand
} from '../../utils/coordinates';
import {
  projectSphereToScreen,
  unprojectScreenToSphere,
  getSphericalDistance,
  getBearing,
  interpolateGreatCircle,
  isPointOccluded
} from '../../utils/projection';
import {
  getEstimatedElevation,
  classifyTerrain,
  isGeographicLand
} from '../../utils/elevation';

interface Benchmark {
  name: string;
  lat: number;
  lon: number;
  expectedZone: number;
  expectedBand: string;
  expectedCol: string;
  expectedRow: string;
}

const BENCHMARKS: Benchmark[] = [
  { name: 'New York City', lat: 40.7128, lon: -74.006, expectedZone: 18, expectedBand: 'T', expectedCol: 'W', expectedRow: 'V' },
  { name: 'Paris', lat: 48.8566, lon: 2.3522, expectedZone: 31, expectedBand: 'U', expectedCol: 'D', expectedRow: 'Q' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, expectedZone: 54, expectedBand: 'S', expectedCol: 'U', expectedRow: 'P' },
  { name: 'Sydney', lat: -33.8688, lon: 151.2093, expectedZone: 56, expectedBand: 'H', expectedCol: 'L', expectedRow: 'S' },
  { name: 'Cairo', lat: 30.0444, lon: 31.2357, expectedZone: 36, expectedBand: 'R', expectedCol: 'U', expectedRow: 'H' },
];

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${msg}`);
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    process.exitCode = 1;
  }
}

console.log('=== TerraGemini M1 Math & Coordinate Engine Verification ===\n');

// 1. COORDINATE CONVERSION & BENCHMARK VERIFICATION
console.log('[1] Coordinate & MGRS Benchmarks:');
for (const b of BENCHMARKS) {
  const utm = latLonToUTM(b.lat, b.lon);
  const mgrs = latLonToMGRS(b.lat, b.lon, 5);
  const all = formatCoordinatesAll(b.lat, b.lon);
  const sector = getSectorGridCode(b.lat, b.lon);

  console.log(`\n  Testing ${b.name} (${b.lat}, ${b.lon}):`);
  console.log(`    UTM:  ${all.utm}`);
  console.log(`    MGRS: ${mgrs}`);
  console.log(`    DD:   ${all.dd}`);
  console.log(`    DMS:  ${all.dms}`);
  console.log(`    SEC:  ${sector}`);

  assert(utm.zoneNumber === b.expectedZone, `${b.name} UTM Zone = ${b.expectedZone}`);
  assert(utm.band === b.expectedBand, `${b.name} Latitude Band = ${b.expectedBand}`);
  assert(mgrs.startsWith(`${b.expectedZone}${b.expectedBand} ${b.expectedCol}${b.expectedRow}`), `${b.name} MGRS 100k Square = ${b.expectedCol}${b.expectedRow}`);
  assert(mgrs.split(' ').length === 4, `${b.name} MGRS format structure valid (4 segments)`);
}

// Check NYC exact reference MGRS
const nycMGRS = latLonToMGRS(40.7128, -74.006, 5);
assert(nycMGRS === '18T WV 83959 07350', `NYC MGRS matches reference standard: "18T WV 83959 07350"`);

// 2. MGRS PRECISION TIERS
console.log('\n[2] MGRS Multi-Precision Scaling:');
assert(latLonToMGRS(40.7128, -74.006, 0) === '18T WV', 'Precision 0 (100km): "18T WV"');
assert(latLonToMGRS(40.7128, -74.006, 1) === '18T WV 8 0', 'Precision 1 (10km): "18T WV 8 0"');
assert(latLonToMGRS(40.7128, -74.006, 2) === '18T WV 83 07', 'Precision 2 (1km): "18T WV 83 07"');
assert(latLonToMGRS(40.7128, -74.006, 3) === '18T WV 839 073', 'Precision 3 (100m): "18T WV 839 073"');
assert(latLonToMGRS(40.7128, -74.006, 4) === '18T WV 8395 0735', 'Precision 4 (10m): "18T WV 8395 0735"');
assert(latLonToMGRS(40.7128, -74.006, 5) === '18T WV 83959 07350', 'Precision 5 (1m): "18T WV 83959 07350"');

// 3. 3D SPHERICAL PROJECTION & RAYCASTING ROUNDTRIP
console.log('\n[3] 3D Spherical Raycasting & Projection Roundtrips:');
const testAngles: [number, number][] = [
  [0, 0],
  [45, 20],
  [-110, -35],
  [180, 0],
  [270, 60],
  [-45, -75]
];
const center = { x: 500, y: 500 };
const scale = 350;

for (const rot of testAngles) {
  for (const b of BENCHMARKS) {
    const proj = projectSphereToScreen(b.lat, b.lon, rot, scale, center);
    if (proj.isVisible) {
      const unproj = unprojectScreenToSphere(proj.x, proj.y, rot, scale, center);
      assert(unproj !== null, `Unproject ${b.name} at rot [${rot}] succeeded`);
      if (unproj) {
        const dLat = Math.abs(unproj.lat - b.lat);
        const dLon = Math.abs(unproj.lon - b.lon);
        assert(dLat < 1e-6 && dLon < 1e-6, `Roundtrip delta < 1e-6 (dLat=${dLat.toExponential(2)}, dLon=${dLon.toExponential(2)})`);
      }
    }
  }
}

// Raycasting out-of-bounds check
const offGlobe = unprojectScreenToSphere(50, 50, [0, 0], scale, center);
assert(offGlobe === null, 'Raycast outside unit sphere correctly returns null');

// Occlusion check
const occluded = isPointOccluded(0, 180, [0, 0]);
assert(occluded === true, 'Point on back of globe is occluded (z <= 0)');
const visible = isPointOccluded(0, 0, [0, 0]);
assert(visible === false, 'Point on front of globe is visible (z > 0)');

// 4. GREAT CIRCLE DISTANCE & BEARING & SLERP
console.log('\n[4] Spherical Distance & Geodesics:');
const distNYCTokyo = getSphericalDistance({ lat: 40.7128, lon: -74.006 }, { lat: 35.6762, lon: 139.6503 });
console.log(`  NYC to Tokyo Distance: ${distNYCTokyo.toFixed(1)} km (expected ~10850 km)`);
assert(distNYCTokyo > 10800 && distNYCTokyo < 10900, 'NYC -> Tokyo great circle distance within 1% of 10,850 km');

const bearingNYCTokyo = getBearing({ lat: 40.7128, lon: -74.006 }, { lat: 35.6762, lon: 139.6503 });
console.log(`  NYC to Tokyo Initial Bearing: ${bearingNYCTokyo.toFixed(1)}° (Northwest over Alaska/Arctic)`);
assert(bearingNYCTokyo > 330 && bearingNYCTokyo < 350, 'NYC -> Tokyo great circle initial bearing ~339° (Northwest/Arctic route)');

const midpoint = interpolateGreatCircle({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }, 0.5);
assert(Math.abs(midpoint.lat) < 1e-6 && Math.abs(midpoint.lon - 45) < 1e-6, 'Slerp midpoint on equator (0,0) to (0,90) is (0,45)');

// 5. TOPOGRAPHIC ELEVATION & TERRAIN CLASSIFICATION
console.log('\n[5] Topographic Elevation & Terrain Classification:');

const everest = getEstimatedElevation(27.9881, 86.925);
console.log(`  Everest Elevation: ${everest.elevationMeters}m, Type: ${everest.terrainType}, Norm: ${everest.normalizedElevation}`);
assert(everest.elevationMeters >= 7500 && everest.elevationMeters <= 8848, 'Everest elevation within [7500m, 8848m]');
assert(everest.terrainType === 'high_plateau', 'Everest classified as high_plateau');
assert(everest.isLand === true, 'Everest is geographic land');

const mariana = getEstimatedElevation(11.3733, 142.1989);
console.log(`  Mariana Trench: ${mariana.elevationMeters}m, Type: ${mariana.terrainType}, Norm: ${mariana.normalizedElevation}`);
assert(mariana.elevationMeters <= -8000, 'Mariana Trench depth <= -8000m');
assert(mariana.terrainType === 'ocean', 'Mariana Trench classified as ocean');
assert(mariana.isLand === false, 'Mariana Trench is ocean');

const nycElev = getEstimatedElevation(40.7128, -74.006);
console.log(`  NYC Elevation: ${nycElev.elevationMeters}m, Type: ${nycElev.terrainType}`);
assert(nycElev.isLand === true, 'NYC is geographic land');
assert(nycElev.elevationMeters > 0 && nycElev.elevationMeters < 500, 'NYC elevation reasonable coastal/plains range');

// 6. ADVERSARIAL BOUNDARY & POLAR TESTS
console.log('\n[6] Adversarial Boundary & Polar Tests:');
// Equator / Null Island & Central Meridian
const nullIslandUTM = latLonToUTM(0, 0);
assert(nullIslandUTM.zoneNumber === 31, 'Null Island (0,0) UTM zone is 31');
assert(nullIslandUTM.band === 'N', 'Null Island (0,0) Latitude Band is N');
assert(Math.round(nullIslandUTM.easting) === 166021, 'Null Island (0,0) Easting is 166,021m (3° west of central meridian)');
assert(Math.abs(nullIslandUTM.northing) < 1.0, 'Null Island (0,0) Northing is ~0m');

const centralMeridianUTM = latLonToUTM(0, 3);
assert(centralMeridianUTM.easting === 500000, 'Central Meridian (0,3) Easting is exactly 500,000m');
assert(centralMeridianUTM.northing === 0, 'Central Meridian (0,3) Northing is exactly 0m');

// Antimeridian (180° / -180°)
const antiUTM1 = latLonToUTM(0, 180);
const antiUTM2 = latLonToUTM(0, -180);
assert(antiUTM1.zoneNumber === 1 || antiUTM1.zoneNumber === 60, 'Antimeridian maps to zone 1 or 60');
assert(antiUTM2.zoneNumber === 1, 'Antimeridian -180 maps to zone 1');

// Extreme latitudes (+84° and -80°)
const northBoundaryUTM = latLonToUTM(84, 0);
assert(northBoundaryUTM.band === 'X', '84°N latitude band is X');
const southBoundaryUTM = latLonToUTM(-80, 0);
assert(southBoundaryUTM.band === 'C', '-80°S latitude band is C');

// Norway & Svalbard UTM special exceptions
const norwayZone = getUTMZone(60, 8);
assert(norwayZone === 32, 'Norway (60°N, 8°E) exception resolves to Zone 32');
const svalbardZone = getUTMZone(78, 15);
assert(svalbardZone === 33, 'Svalbard (78°N, 15°E) exception resolves to Zone 33');

console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log(`========================================\n`);

if (passedTests === totalTests) {
  console.log('✓ ALL M1 MATHEMATICAL ENGINES & ADVERSARIAL EDGE CASES VERIFIED SUCCESSFULLY.');
}
