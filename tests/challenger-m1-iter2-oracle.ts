import {
  getUTMZone,
  getLatitudeBand,
  latLonToUTM,
  latLonToMGRS,
  latLonToDD,
  latLonToDMS,
  formatUTM,
  formatDD,
  formatDMS,
  getSectorGridCode,
  formatCoordinatesAll,
} from '../utils/coordinates';
import {
  projectSphereToScreen,
  unprojectScreenToSphere,
  getSphericalDistance,
  getBearing,
  interpolateGreatCircle,
  isPointOccluded,
} from '../utils/projection';
import {
  getEstimatedElevation,
  classifyTerrain,
  isGeographicLand,
} from '../utils/elevation';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(suite: string, name: string, condition: boolean, details?: any) {
  if (condition) {
    results.push({ suite, name, passed: true, details });
  } else {
    const msg = `Assertion failed for [${suite}] ${name}`;
    console.error('❌ FAIL:', msg, details);
    results.push({ suite, name, passed: false, error: msg, details });
  }
}

console.log('================================================================');
console.log('EMPIRICAL CHALLENGER ORACLE & ADVERSARIAL STRESS SUITE (M1 ITER 2)');
console.log('Timestamp:', new Date().toISOString());
console.log('================================================================\n');

// ============================================================================
// SUITE 1: NON-FINITE, NULL, UNDEFINED & BOUNDARY ROBUSTNESS
// ============================================================================
console.log('>>> [1/4] Testing NaN, undefined, null, infinity & boundary robustness...');

// 1.1 coordinates.ts non-finite guards
try {
  assert('Robustness', 'getUTMZone(NaN, NaN) returns 1 without throwing', getUTMZone(NaN, NaN) === 1);
  assert('Robustness', 'getUTMZone(Infinity, -Infinity) returns 1', getUTMZone(Infinity, -Infinity) === 1);
  assert('Robustness', 'getLatitudeBand(NaN) returns empty string', getLatitudeBand(NaN) === '');
  assert('Robustness', 'getLatitudeBand(Infinity) returns empty string', getLatitudeBand(Infinity) === '');
  assert('Robustness', 'latLonToUTM(NaN, NaN) returns safe 0-object', latLonToUTM(NaN, NaN).zoneNumber === 0);
  assert('Robustness', 'latLonToMGRS(NaN, NaN) returns empty string', latLonToMGRS(NaN, NaN) === '');
  assert('Robustness', 'latLonToMGRS(40, -74, NaN) defaults gracefully', latLonToMGRS(40, -74, NaN).startsWith('18T WL'));
  assert('Robustness', 'latLonToMGRS(40, -74, -5) clamps precision to 0', latLonToMGRS(40, -74, -5) === '18T WL');
  assert('Robustness', 'latLonToMGRS(40, -74, 10) clamps precision to 5', latLonToMGRS(40, -74, 10).replace(/\s+/g, '').length === 15);
  assert('Robustness', 'latLonToDD(NaN, NaN) returns empty string', latLonToDD(NaN, NaN) === '');
  assert('Robustness', 'latLonToDMS(NaN, NaN) returns empty string', latLonToDMS(NaN, NaN) === '');
  assert('Robustness', 'formatUTM(null as any) returns empty string', formatUTM(null as any) === '');
  assert('Robustness', 'formatUTM zero obj returns empty string', formatUTM({ zoneNumber: 0, band: '', easting: 0, northing: 0 }) === '');
  assert('Robustness', 'getSectorGridCode(NaN, NaN) returns empty string', getSectorGridCode(NaN, NaN) === '');
  
  const allFormatted = formatCoordinatesAll(NaN, NaN);
  assert('Robustness', 'formatCoordinatesAll(NaN, NaN) returns empty strings and does not crash',
    allFormatted.dd === '' && allFormatted.dms === '' && allFormatted.utm === '' && allFormatted.mgrs === ''
  );
} catch (e: any) {
  assert('Robustness', 'coordinates.ts threw unhandled exception', false, e.message);
}

// 1.2 projection.ts non-finite guards
try {
  const pProj1 = projectSphereToScreen(NaN, NaN, [0, 0], 100, { x: 0, y: 0 });
  assert('Robustness', 'projectSphereToScreen(NaN, NaN, ...) returns isVisible: false', pProj1.isVisible === false);

  const pProj2 = projectSphereToScreen(0, 0, [NaN, 0], 100, { x: 0, y: 0 });
  assert('Robustness', 'projectSphereToScreen with NaN rotation returns isVisible: false', pProj2.isVisible === false);

  const pProj3 = projectSphereToScreen(0, 0, [0, 0], -10, { x: 0, y: 0 });
  assert('Robustness', 'projectSphereToScreen with negative scale returns isVisible: false', pProj3.isVisible === false);

  const pProj4 = projectSphereToScreen(0, 0, [0, 0], 100, null as any);
  assert('Robustness', 'projectSphereToScreen with null center returns isVisible: false', pProj4.isVisible === false);

  const pUnproj1 = unprojectScreenToSphere(NaN, NaN, [0, 0], 100, { x: 0, y: 0 });
  assert('Robustness', 'unprojectScreenToSphere(NaN, NaN, ...) returns null', pUnproj1 === null);

  const pUnproj2 = unprojectScreenToSphere(0, 0, [NaN, 0], 100, { x: 0, y: 0 });
  assert('Robustness', 'unprojectScreenToSphere with NaN rotation returns null', pUnproj2 === null);

  const pUnproj3 = unprojectScreenToSphere(0, 0, [0, 0], 0, { x: 0, y: 0 });
  assert('Robustness', 'unprojectScreenToSphere with 0 scale returns null', pUnproj3 === null);

  const pUnproj4 = unprojectScreenToSphere(0, 0, [0, 0], 100, null as any);
  assert('Robustness', 'unprojectScreenToSphere with null center returns null', pUnproj4 === null);
} catch (e: any) {
  assert('Robustness', 'projection.ts threw unhandled exception', false, e.message);
}

// 1.3 elevation.ts non-finite guards
try {
  const elevNaN = getEstimatedElevation(NaN, NaN);
  assert('Robustness', 'getEstimatedElevation(NaN, NaN) returns valid structure with 0 elevation',
    elevNaN.elevationMeters === 0 && !elevNaN.isLand && Number.isFinite(elevNaN.normalizedElevation)
  );

  const elevInf = getEstimatedElevation(Infinity, -Infinity);
  assert('Robustness', 'getEstimatedElevation(Infinity, -Infinity) returns safe fallback',
    elevInf.elevationMeters === 0 && !elevInf.isLand
  );

  const landNaN = isGeographicLand(NaN, NaN);
  assert('Robustness', 'isGeographicLand(NaN, NaN) returns false', landNaN === false);

  const classNaN = classifyTerrain(NaN, NaN);
  assert('Robustness', 'classifyTerrain(NaN, NaN) returns ocean without throwing', classNaN === 'ocean');
} catch (e: any) {
  assert('Robustness', 'elevation.ts threw unhandled exception', false, e.message);
}


// ============================================================================
// SUITE 2: ANTIMERIDIAN CONTINUITY & SPHERICAL GEOMETRY ACROSS ±180°
// ============================================================================
console.log('>>> [2/4] Testing antimeridian continuity across ±180°...');

let maxAntimeridianDelta = 0;
let worstLat = 0;
for (let lat = -90; lat <= 90; lat += 0.5) {
  const west = getEstimatedElevation(lat, -180);
  const east = getEstimatedElevation(lat, 180);

  const delta = Math.abs(west.elevationMeters - east.elevationMeters);
  if (delta > maxAntimeridianDelta) {
    maxAntimeridianDelta = delta;
    worstLat = lat;
  }

  if (west.isLand !== east.isLand || west.terrainType !== east.terrainType || west.normalizedElevation !== east.normalizedElevation) {
    assert('Antimeridian', `Discrepancy at lat ${lat}`, false, { west, east });
  }
}
assert('Antimeridian', 'Elevation delta across -180° vs +180° is exactly 0m across all latitudes (-90° to +90° in 0.5° steps)',
  maxAntimeridianDelta === 0, { maxAntimeridianDelta, worstLat }
);

// Test continuity across seam: (-179.999° vs +179.999°)
let maxSeamStepDelta = 0;
for (let lat = -80; lat <= 80; lat += 5) {
  const elevWest = getEstimatedElevation(lat, -179.999).elevationMeters;
  const elevEast = getEstimatedElevation(lat, 179.999).elevationMeters;
  const delta = Math.abs(elevWest - elevEast);
  if (delta > maxSeamStepDelta) {
    maxSeamStepDelta = delta;
  }
}
assert('Antimeridian', 'Micro-step delta across seam (-179.999° to +179.999°) is smooth (< 5m)',
  maxSeamStepDelta < 5.0, { maxSeamStepDelta }
);

// Test Great Circle Slerp across antimeridian
const ptWest = { lat: 15.0, lon: 175.0 };
const ptEast = { lat: 15.0, lon: -175.0 };
const slerpDist = getSphericalDistance(ptWest, ptEast);
// Angular distance is 10° along latitude 15°, great circle distance ~1,073 km
assert('Antimeridian', 'getSphericalDistance across antimeridian (175° to -175°) is ~1,073 km, NOT ~37,000 km',
  slerpDist > 1000 && slerpDist < 1150, { slerpDist }
);

const slerpMid = interpolateGreatCircle(ptWest, ptEast, 0.5);
assert('Antimeridian', 'interpolateGreatCircle midpoint across antimeridian is at longitude ±180°',
  Math.abs(Math.abs(slerpMid.lon) - 180.0) < 0.01 && Math.abs(slerpMid.lat - 15.0) < 0.5,
  { slerpMid }
);


// ============================================================================
// SUITE 3: MGRS CANONICAL MILITARY COORDINATES ACROSS ALL 60 UTM ZONES
// ============================================================================
console.log('>>> [3/4] Testing MGRS canonical military coordinates across all 60 UTM zones...');

const MGRS_COL_SETS = [
  'ABCDEFGH', // Set 1 (zones 1, 4, 7, ..., 58)
  'JKLMNPQR', // Set 2 (zones 2, 5, 8, ..., 59)
  'STUVWXYZ', // Set 3 (zones 3, 6, 9, ..., 60)
];
const MGRS_ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUV';

let zoneFailures = 0;
for (let zone = 1; zone <= 60; zone++) {
  const centralLon = (zone - 1) * 6 - 180 + 3;
  
  // Test in Northern Hemisphere (lat = 20.0°N -> Band Q)
  const latN = 20.0;
  const utmN = latLonToUTM(latN, centralLon);
  const mgrsN = latLonToMGRS(latN, centralLon, 5);

  if (utmN.zoneNumber !== zone) {
    assert('MGRS 60 Zones', `Zone ${zone} N UTM zone number mismatch`, false, { utmN, expectedZone: zone });
    zoneFailures++;
  }
  if (Math.abs(utmN.easting - 500000) > 1.0) {
    assert('MGRS 60 Zones', `Zone ${zone} N Central meridian easting != 500,000m`, false, { utmN });
    zoneFailures++;
  }

  // Verify column letter matches set
  const expectedSetIndex = (zone - 1) % 3;
  const expectedColLetter = MGRS_COL_SETS[expectedSetIndex].charAt(4); // 500k -> colIndex = 4
  
  // Verify row letter offset (even -> 5, odd -> 0)
  const expectedRowOffset = zone % 2 === 0 ? 5 : 0;
  const expectedRowIndex = (Math.floor((utmN.northing % 2000000.0) / 100000.0) + expectedRowOffset) % 20;
  const expectedRowLetter = MGRS_ROW_LETTERS.charAt(expectedRowIndex);

  const partsN = mgrsN.split(' ');
  const gzdN = partsN[0]; // e.g. "18Q"
  const sqN = partsN[1];  // e.g. "UJ"

  if (gzdN !== `${zone}Q`) {
    assert('MGRS 60 Zones', `Zone ${zone} N GZD mismatch`, false, { observed: gzdN, expected: `${zone}Q` });
    zoneFailures++;
  }
  if (sqN !== `${expectedColLetter}${expectedRowLetter}`) {
    assert('MGRS 60 Zones', `Zone ${zone} N 100k square mismatch`, false, {
      observed: sqN,
      expected: `${expectedColLetter}${expectedRowLetter}`,
      zone,
      isEven: zone % 2 === 0,
      rowOffset: expectedRowOffset,
    });
    zoneFailures++;
  }

  // Test in Southern Hemisphere (lat = -20.0°S -> Band K)
  const latS = -20.0;
  const utmS = latLonToUTM(latS, centralLon);
  const mgrsS = latLonToMGRS(latS, centralLon, 5);

  if (utmS.northing <= 0 || utmS.northing >= 10000000) {
    assert('MGRS 60 Zones', `Zone ${zone} S false northing out of range`, false, { utmS });
    zoneFailures++;
  }
  const partsS = mgrsS.split(' ');
  if (partsS[0] !== `${zone}K`) {
    assert('MGRS 60 Zones', `Zone ${zone} S GZD mismatch`, false, { observed: partsS[0], expected: `${zone}K` });
    zoneFailures++;
  }
}

assert('MGRS 60 Zones', 'All 60 UTM zones correctly encode canonical MGRS (Col Sets 1..3, Row Offset 0/5, False Northing)',
  zoneFailures === 0, { zoneFailures }
);


// ============================================================================
// SUITE 4: OCEANIC TRENCH BATHYMETRY VS LANDMASK
// ============================================================================
console.log('>>> [4/4] Testing oceanic trench bathymetry vs landmask...');

const trenches = [
  { name: 'Mariana Trench (Challenger Deep)', lat: 11.3733, lon: 142.1989, maxElev: -10000, minElev: -11034 },
  { name: 'Tonga Trench (Horizon Deep)', lat: -23.2833, lon: -174.75, maxElev: -10000, minElev: -11034 },
  { name: 'Philippine Trench', lat: 10.1, lon: 126.7, maxElev: -9500, minElev: -11034 },
  { name: 'Kurile-Kamchatka Trench', lat: 45.0, lon: 153.0, maxElev: -9500, minElev: -11034 },
  { name: 'Puerto Rico Trench (Milwaukee Deep)', lat: 19.7, lon: -66.5, maxElev: -7500, minElev: -9500 },
  { name: 'Java Trench', lat: -10.3, lon: 109.9, maxElev: -6500, minElev: -8500 },
];

for (const t of trenches) {
  const elev = getEstimatedElevation(t.lat, t.lon);
  const land = isGeographicLand(t.lat, t.lon);

  assert('Bathymetry', `${t.name} isLand === false`, elev.isLand === false);
  assert('Bathymetry', `${t.name} terrainType === 'ocean'`, elev.terrainType === 'ocean');
  assert('Bathymetry', `${t.name} elevation is within [${t.minElev}m .. ${t.maxElev}m] (got ${elev.elevationMeters}m)`,
    elev.elevationMeters <= t.maxElev && elev.elevationMeters >= t.minElev,
    { observed: elev.elevationMeters, expectedRange: [t.minElev, t.maxElev] }
  );
  assert('Bathymetry', `${t.name} description contains trench name`, elev.description.includes(t.name.split(' ')[0]), { description: elev.description });
}

// Check Puerto Rico island (San Juan: 18.46°N, -66.1°W) vs Puerto Rico Trench (19.7°N, -66.5°W)
// San Juan is nearby land; let's check landmask and elevation of San Juan & surrounding islands
const denver = getEstimatedElevation(39.7392, -104.9903);
assert('Bathymetry', 'Denver CO is land with elevation > 1500m', denver.isLand === true && denver.elevationMeters > 1500, denver);

const tokyo = getEstimatedElevation(35.6762, 139.6503);
assert('Bathymetry', 'Tokyo Japan is land with elevation > 0m', tokyo.isLand === true && tokyo.elevationMeters > 0, tokyo);

const montBlanc = getEstimatedElevation(45.8326, 6.8652);
assert('Bathymetry', 'Mont Blanc (European Alps) has elevation > 4000m', montBlanc.isLand === true && montBlanc.elevationMeters > 4000, montBlanc);

const mtElbrus = getEstimatedElevation(43.3499, 42.4453);
assert('Bathymetry', 'Mount Elbrus (Caucasus) has elevation > 5000m', mtElbrus.isLand === true && mtElbrus.elevationMeters > 5000, mtElbrus);


// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n================================================================');
console.log('CHALLENGER ORACLE VERIFICATION SUMMARY');
console.log('================================================================');
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`Total Assertions: ${results.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log('\nFAILED ASSERTIONS:');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`❌ [${r.suite}] ${r.name}: ${r.error}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ALL 100% EMPIRICAL CHALLENGER ASSERTIONS PASSED PERFECTLY!');
  process.exit(0);
}
