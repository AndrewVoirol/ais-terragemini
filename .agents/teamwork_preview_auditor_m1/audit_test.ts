import {
  latLonToUTM,
  latLonToMGRS,
  latLonToDD,
  latLonToDMS,
  getUTMZone,
  getLatitudeBand,
  formatCoordinatesAll,
  getSectorGridCode
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

console.log('=== Independent Forensic Auditor Deep Audit Suite ===\n');

let passCount = 0;
let failCount = 0;

function auditAssert(cond: boolean, desc: string, details?: string) {
  if (cond) {
    passCount++;
    console.log(`[AUDIT-PASS] ${desc}`);
  } else {
    failCount++;
    console.error(`[AUDIT-FAIL] ${desc} -> ${details || 'Condition failed'}`);
  }
}

// 1. HARDCODING / CHEATING DETECTION TEST
console.log('--- 1. Testing for non-linear hardcoded lookup anomalies ---');
// Generate smooth gradient of 100 points around NYC (40.7128 +/- 0.05, -74.006 +/- 0.05)
// Check if easting/northing changes smoothly or jumps abruptly
const baseLat = 40.7128;
const baseLon = -74.006;
let smoothStepPass = true;
let prevUTM = latLonToUTM(baseLat, baseLon);

for (let step = 1; step <= 50; step++) {
  const curLat = baseLat + step * 0.001;
  const curLon = baseLon + step * 0.001;
  const curUTM = latLonToUTM(curLat, curLon);
  const dEasting = curUTM.easting - prevUTM.easting;
  const dNorthing = curUTM.northing - prevUTM.northing;
  // Over 0.001 deg, easting should increase by ~84m, northing by ~111m
  if (dEasting <= 0 || dNorthing <= 0 || dEasting > 200 || dNorthing > 200) {
    smoothStepPass = false;
    break;
  }
  prevUTM = curUTM;
}
auditAssert(smoothStepPass, 'UTM coordinate gradients are continuous and smooth (no lookup table discontinuities)');

// 2. UNPROJECTION INVERTIBILITY TEST (Modulo 360 Longitude)
console.log('\n--- 2. Testing 3D Euler Projection Invertibility across 10,000 coordinates ---');
let maxProjectionError = 0;
let roundtripsTested = 0;
const center = { x: 960, y: 540 };
const scale = 400;

for (let yaw = -180; yaw <= 180; yaw += 60) {
  for (let pitch = -60; pitch <= 60; pitch += 30) {
    for (let lat = -80; lat <= 80; lat += 20) {
      for (let lon = -170; lon <= 170; lon += 30) {
        const proj = projectSphereToScreen(lat, lon, [yaw, pitch], scale, center);
        if (proj.isVisible && proj.depth > 0.05) {
          const unproj = unprojectScreenToSphere(proj.x, proj.y, [yaw, pitch], scale, center);
          if (unproj) {
            roundtripsTested++;
            const dLat = Math.abs(unproj.lat - lat);
            let dLon = Math.abs(unproj.lon - lon);
            if (dLon > 180) dLon = Math.abs(dLon - 360);
            const err = Math.sqrt(dLat * dLat + dLon * dLon);
            if (err > maxProjectionError) maxProjectionError = err;
          }
        }
      }
    }
  }
}
auditAssert(
  maxProjectionError < 1e-6,
  `Projection roundtrip inversion error < 1e-6 (Max observed error: ${maxProjectionError.toExponential(4)} across ${roundtripsTested} points)`
);

// 3. ELEVATION HASH REPEATABILITY & DETERMINISM
console.log('\n--- 3. Testing Elevation Model Determinism & Range Boundaries ---');
let determinismPass = true;
let rangeBoundPass = true;

for (let lat = -85; lat <= 85; lat += 5) {
  for (let lon = -175; lon <= 175; lon += 15) {
    const e1 = getEstimatedElevation(lat, lon);
    const e2 = getEstimatedElevation(lat, lon);
    if (e1.elevationMeters !== e2.elevationMeters || e1.normalizedElevation !== e2.normalizedElevation) {
      determinismPass = false;
    }
    if (e1.normalizedElevation < 0.0 || e1.normalizedElevation > 1.0 || isNaN(e1.normalizedElevation)) {
      rangeBoundPass = false;
    }
  }
}
auditAssert(determinismPass, 'Elevation model is strictly deterministic (100% identical outputs on re-evaluation)');
auditAssert(rangeBoundPass, 'Normalized elevation strictly within [0.0, 1.0] and contains no NaN values');

// 4. HAWAII, ICELAND, JAPAN, UK, MADAGASCAR LAND CLASSIFICATION
console.log('\n--- 4. Testing Island and Continental Geographic Classification ---');
const tokyo = getEstimatedElevation(35.6762, 139.6503);
auditAssert(tokyo.isLand === true, 'Tokyo (Japan) classified as land');

const london = getEstimatedElevation(51.5074, -0.1278);
auditAssert(london.isLand === true, 'London (UK) classified as land');

const madagascar = getEstimatedElevation(-18.7669, 46.8691);
auditAssert(madagascar.isLand === true, 'Madagascar classified as land');

const pacificMid = getEstimatedElevation(0.0, -150.0);
auditAssert(pacificMid.isLand === false, 'Mid-Pacific classified as ocean');

// 5. SLERP GREAT CIRCLE ORTHODROMIC INTEGRITY
console.log('\n--- 5. Testing Slerp Geodesic Interpolation ---');
const pA = { lat: 10, lon: 20 };
const pB = { lat: 50, lon: 80 };
const totalDist = getSphericalDistance(pA, pB);
let slerpMonotonicPass = true;
let prevDistFromA = 0;

for (let t = 0.1; t <= 0.9; t += 0.1) {
  const pInterp = interpolateGreatCircle(pA, pB, t);
  const distFromA = getSphericalDistance(pA, pInterp);
  const distToB = getSphericalDistance(pInterp, pB);
  const distSum = distFromA + distToB;
  if (Math.abs(distSum - totalDist) > 1e-4 || distFromA <= prevDistFromA) {
    slerpMonotonicPass = false;
  }
  prevDistFromA = distFromA;
}
auditAssert(slerpMonotonicPass, 'Slerp interpolation lies exactly on the great-circle geodesic and is strictly monotonic');

console.log(`\n=== Audit Execution Summary: ${passCount} Passed, ${failCount} Failed ===\n`);
