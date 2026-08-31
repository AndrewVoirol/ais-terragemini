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

console.log('=== ADVERSARIAL STRESS TEST SUITE ===\n');

let failures = 0;
let tests = 0;

function check(desc: string, passed: boolean, details?: any) {
  tests++;
  if (!passed) {
    failures++;
    console.error(`[FAIL] ${desc}`, details || '');
  } else {
    console.log(`[PASS] ${desc}`);
  }
}

// 1. Extreme and Adversarial Inputs for Coordinate Engine
console.log('\n--- 1. Coordinate Engine Adversarial Stress ---');

// Poles and beyond
const northPole = latLonToUTM(90, 0);
check('Lat 90 clamped without NaN', !isNaN(northPole.easting) && !isNaN(northPole.northing));
const southPole = latLonToUTM(-90, 0);
check('Lat -90 clamped without NaN', !isNaN(southPole.easting) && !isNaN(southPole.northing));

// Longitude wrapping (> 360, < -360)
const wrapLon1 = latLonToUTM(40, 720); // 720 = 0
check('Lon 720 wrapped to zone 31', wrapLon1.zoneNumber === 31);
const wrapLon2 = latLonToUTM(40, -540); // -540 = -180
check('Lon -540 wrapped to zone 1', wrapLon2.zoneNumber === 1);

// MGRS Precision extremes
const mgrsP0 = latLonToMGRS(40.7128, -74.006, 0);
check('MGRS precision 0 is 100km square', mgrsP0 === '18T WV');
const mgrsPneg = latLonToMGRS(40.7128, -74.006, -5);
check('MGRS negative precision clamped to 0', mgrsPneg === '18T WV');
const mgrsP10 = latLonToMGRS(40.7128, -74.006, 10);
check('MGRS precision > 5 clamped to 5', mgrsP10 === '18T WV 83959 07350');

// DMS zero and boundary formatting
const dmsZero = latLonToDMS(0, 0);
check('DMS (0,0) format string valid', dmsZero.includes('00° 00\' 00.0" N') && dmsZero.includes('000° 00\' 00.0" E'));

// 2. Projection Engine Adversarial Stress
console.log('\n--- 2. Projection Engine Adversarial Stress ---');

// Scale = 0 or negative scale
const unprojScale0 = unprojectScreenToSphere(100, 100, [0, 0], 0, { x: 100, y: 100 });
check('unprojectScreenToSphere scale=0 returns null', unprojScale0 === null);
const unprojScaleNeg = unprojectScreenToSphere(100, 100, [0, 0], -100, { x: 100, y: 100 });
check('unprojectScreenToSphere scale < 0 returns null', unprojScaleNeg === null);

// Exactly on unit circle horizon (r = 1.0)
const unprojHorizon = unprojectScreenToSphere(300, 100, [0, 0], 200, { x: 100, y: 100 }); // dx = 200 = scale
check('unproject on horizon circle (dx = scale) returns valid coords', unprojHorizon !== null && !isNaN(unprojHorizon.lat) && !isNaN(unprojHorizon.lon));

// Slerp identical points
const slerpSame = interpolateGreatCircle({ lat: 35, lon: 139 }, { lat: 35, lon: 139 }, 0.5);
check('Slerp identical points returns same point', Math.abs(slerpSame.lat - 35) < 1e-4 && Math.abs(slerpSame.lon - 139) < 1e-4);

// Slerp antipodal points (180° opposite)
const slerpAntipodal = interpolateGreatCircle({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }, 0.5);
check('Slerp antipodal points does not return NaN', !isNaN(slerpAntipodal.lat) && !isNaN(slerpAntipodal.lon));

// Distance between identical points
const distZero = getSphericalDistance({ lat: 10, lon: 20 }, { lat: 10, lon: 20 });
check('Distance between identical points is 0', distZero === 0);

// Bearing between identical points
const bearingZero = getBearing({ lat: 10, lon: 20 }, { lat: 10, lon: 20 });
check('Bearing between identical points does not return NaN', !isNaN(bearingZero));

// 3. Elevation Model Stress & Geographic Distribution
console.log('\n--- 3. Elevation & Terrain Stress ---');

// Check 1,000 randomized coordinates across the globe for NaN or out-of-bounds
let elevErrors = 0;
for (let i = 0; i < 1000; i++) {
  const lat = (Math.random() - 0.5) * 180;
  const lon = (Math.random() - 0.5) * 360;
  const elev = getEstimatedElevation(lat, lon);
  if (
    isNaN(elev.elevationMeters) ||
    isNaN(elev.normalizedElevation) ||
    elev.normalizedElevation < 0 ||
    elev.normalizedElevation > 1 ||
    elev.elevationMeters < -11034 ||
    elev.elevationMeters > 8848
  ) {
    elevErrors++;
  }
}
check('1000 random points have normalized elevation in [0, 1] and meters in [-11034, 8848]', elevErrors === 0);

// 4. Performance & Throughput Benchmark
console.log('\n--- 4. Performance & Throughput Benchmark ---');

const ITERATIONS = 100000;
const startMGRS = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  latLonToMGRS(40.7128 + (i % 100) * 0.01, -74.006 + (i % 100) * 0.01, 5);
}
const elapsedMGRS = performance.now() - startMGRS;
const mgrsThroughput = Math.round(ITERATIONS / (elapsedMGRS / 1000));
console.log(`  MGRS: ${ITERATIONS} conversions in ${elapsedMGRS.toFixed(1)}ms (${mgrsThroughput} ops/sec)`);
check('MGRS throughput > 50,000 ops/sec', mgrsThroughput > 50000);

const startProj = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  projectSphereToScreen(40.7128, -74.006, [i * 0.1, i * 0.05], 250, { x: 500, y: 500 });
}
const elapsedProj = performance.now() - startProj;
const projThroughput = Math.round(ITERATIONS / (elapsedProj / 1000));
console.log(`  Projection: ${ITERATIONS} forward projections in ${elapsedProj.toFixed(1)}ms (${projThroughput} ops/sec)`);
check('Projection throughput > 100,000 ops/sec', projThroughput > 100000);

const startElev = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  getEstimatedElevation(40.7128 + (i % 100) * 0.01, -74.006 + (i % 100) * 0.01);
}
const elapsedElev = performance.now() - startElev;
const elevThroughput = Math.round(ITERATIONS / (elapsedElev / 1000));
console.log(`  Elevation: ${ITERATIONS} elevation evaluations in ${elapsedElev.toFixed(1)}ms (${elevThroughput} ops/sec)`);
check('Elevation throughput > 50,000 ops/sec', elevThroughput > 50000);

console.log(`\n========================================`);
console.log(`Stress Test Results: ${tests - failures}/${tests} passed`);
console.log(`========================================\n`);

if (failures > 0) {
  process.exit(1);
}
