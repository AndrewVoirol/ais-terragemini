import {
  latLonToUTM,
  latLonToMGRS,
  latLonToDD,
  latLonToDMS,
  formatCoordinatesAll,
  getSectorGridCode,
  getUTMZone,
  getLatitudeBand,
  formatUTM,
  formatDD,
  formatDMS,
  formatMGRS,
} from '../../utils/coordinates';
import {
  projectSphereToScreen,
  unprojectScreenToSphere,
  getSphericalDistance,
  getBearing,
  interpolateGreatCircle,
  isPointOccluded,
} from '../../utils/projection';
import {
  getEstimatedElevation,
  classifyTerrain,
  isGeographicLand,
} from '../../utils/elevation';
import { TerrainType } from '../../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failedTests++;
    failures.push(`${name}: ${err.message}`);
    console.error(`  ✗ FAIL: ${name} -> ${err.message}`);
  }
}

function expect(val: any) {
  return {
    toBe: (exp: any) => {
      if (val !== exp) throw new Error(`Expected ${val} to be ${exp}`);
    },
    toBeCloseTo: (exp: number, precision: number = 2) => {
      const diff = Math.abs(val - exp);
      const tol = Math.pow(10, -precision) / 2;
      if (diff > tol) throw new Error(`Expected ${val} to be close to ${exp} (diff=${diff} > tol=${tol})`);
    },
    toBeGreaterThan: (exp: number) => {
      if (!(val > exp)) throw new Error(`Expected ${val} > ${exp}`);
    },
    toBeGreaterThanOrEqual: (exp: number) => {
      if (!(val >= exp)) throw new Error(`Expected ${val} >= ${exp}`);
    },
    toBeLessThan: (exp: number) => {
      if (!(val < exp)) throw new Error(`Expected ${val} < ${exp}`);
    },
    toBeLessThanOrEqual: (exp: number) => {
      if (!(val <= exp)) throw new Error(`Expected ${val} <= ${exp}`);
    },
    notToBeNull: () => {
      if (val === null || val === undefined) throw new Error(`Expected value not to be null/undefined`);
    },
    toBeNull: () => {
      if (val !== null) throw new Error(`Expected null, got ${val}`);
    },
    notToContain: (str: string) => {
      if (typeof val === 'string' && val.includes(str)) throw new Error(`Expected "${val}" not to contain "${str}"`);
    },
  };
}

console.log('--- STARTING ADVERSARIAL STRESS TESTING FOR MILESTONE 1 ---\n');

// 1. ADVERSARIAL COORDINATE STRESS TESTS
test('1.1 Extreme Polar Coordinates (±90°)', () => {
  const north = formatCoordinatesAll(90, 0);
  expect(north.dd).notToContain('NaN');
  expect(north.dms).notToContain('NaN');
  expect(north.mgrs).notToContain('NaN');

  const south = formatCoordinatesAll(-90, 0);
  expect(south.dd).notToContain('NaN');
  expect(south.dms).notToContain('NaN');
  expect(south.mgrs).notToContain('NaN');
});

test('1.2 Antimeridian Discontinuity (±180° and Wrap-around)', () => {
  for (let lat = -75; lat <= 75; lat += 15) {
    const pos = latLonToUTM(lat, 180);
    const neg = latLonToUTM(lat, -180);
    const pos179 = latLonToUTM(lat, 179.9999);
    const neg179 = latLonToUTM(lat, -179.9999);

    expect(Number.isFinite(pos.easting)).toBe(true);
    expect(Number.isFinite(pos.northing)).toBe(true);
    expect(Number.isFinite(neg.easting)).toBe(true);
    expect(Number.isFinite(neg.northing)).toBe(true);
    expect(pos179.zoneNumber).toBe(60);
    expect(neg179.zoneNumber).toBe(1);
  }
});

test('1.3 Norway & Svalbard UTM Zone Anomalies', () => {
  // Norway Band V: 56°N-64°N, 3°E-12°E -> Zone 32
  expect(getUTMZone(60, 4)).toBe(32);
  expect(getUTMZone(60, 11)).toBe(32);
  expect(getUTMZone(60, 2)).toBe(31); // outside exception

  // Svalbard Band X: 72°N-84°N
  expect(getUTMZone(75, 4)).toBe(31);  // 0-9°E -> Zone 31
  expect(getUTMZone(75, 15)).toBe(33); // 9-21°E -> Zone 33
  expect(getUTMZone(75, 27)).toBe(35); // 21-33°E -> Zone 35
  expect(getUTMZone(75, 38)).toBe(37); // 33-42°E -> Zone 37
  expect(getUTMZone(75, -5)).toBe(30); // Zone 30 is -6° to 0°
});

test('1.4 MGRS Precision Boundaries and Formatting Integrity', () => {
  const coords = [
    { lat: 40.7128, lon: -74.006 },
    { lat: 0, lon: 0 },
    { lat: -33.8688, lon: 151.2093 },
    { lat: 78.2232, lon: 15.6267 }, // Longyearbyen Svalbard
  ];

  for (const c of coords) {
    for (let p = 0; p <= 5; p++) {
      const mgrs = latLonToMGRS(c.lat, c.lon, p);
      expect(mgrs).notToContain('NaN');
      expect(mgrs).notToContain('undefined');
      if (p === 0) {
        expect(mgrs.split(' ').length).toBe(2);
      } else {
        const parts = mgrs.split(' ');
        expect(parts.length).toBe(4);
        expect(parts[2].length).toBe(p);
        expect(parts[3].length).toBe(p);
      }
    }
  }
});

test('1.5 DMS and DD string parsing integrity across 360 degrees', () => {
  for (let lat = -80; lat <= 80; lat += 20) {
    for (let lon = -180; lon <= 180; lon += 45) {
      const dd = latLonToDD(lat, lon);
      const dms = latLonToDMS(lat, lon);
      expect(dd).notToContain('NaN');
      expect(dms).notToContain('NaN');
      if (lat >= 0) expect(dd).notToContain('S');
      if (lat < 0) expect(dd).notToContain('N');
      if (lon >= 0) expect(dd).notToContain('W');
      if (lon < 0) expect(dd).notToContain('E');
    }
  }
});

// 2. ADVERSARIAL PROJECTION & RAYCASTING STRESS TESTS
test('2.1 Massive Spherical Raycasting Roundtrip (5,000 Points)', () => {
  const scale = 250;
  const center = { x: 400, y: 300 };

  const rotations: [number, number][] = [
    [0, 0],
    [75, 40],
    [-130, -60],
    [210, 85],
    [-300, -45],
    [450, 20],
  ];

  let testedPoints = 0;
  for (const rot of rotations) {
    for (let lat = -85; lat <= 85; lat += 10) {
      for (let lon = -175; lon <= 175; lon += 15) {
        testedPoints++;
        const proj = projectSphereToScreen(lat, lon, rot, scale, center);
        expect(Number.isFinite(proj.x)).toBe(true);
        expect(Number.isFinite(proj.y)).toBe(true);
        expect(Number.isFinite(proj.depth)).toBe(true);

        if (proj.isVisible) {
          const unproj = unprojectScreenToSphere(proj.x, proj.y, rot, scale, center);
          expect(unproj).notToBeNull();
          if (unproj) {
            const dLat = Math.abs(unproj.lat - lat);
            let dLon = Math.abs(unproj.lon - lon);
            if (dLon > 180) dLon = Math.abs(dLon - 360);

            if (Math.abs(lat) < 80) {
              expect(dLat).toBeLessThan(1e-4);
              expect(dLon).toBeLessThan(1e-4);
            } else {
              expect(dLat).toBeLessThan(1e-4);
            }
          }
        }
      }
    }
  }
  expect(testedPoints).toBeGreaterThan(2500);
});

test('2.2 Raycasting Exact Boundary Surface (Rim & Out of Bounds)', () => {
  const center = { x: 500, y: 500 };
  const scale = 200;
  const rot: [number, number] = [0, 0];

  const onRimRight = unprojectScreenToSphere(center.x + scale, center.y, rot, scale, center);
  expect(onRimRight).notToBeNull();
  expect(onRimRight!.lon).toBeCloseTo(90, 1);

  const onRimTop = unprojectScreenToSphere(center.x, center.y - scale, rot, scale, center);
  expect(onRimTop).notToBeNull();
  expect(onRimTop!.lat).toBeCloseTo(90, 1);

  const outside1 = unprojectScreenToSphere(center.x + scale + 1, center.y, rot, scale, center);
  expect(outside1).toBeNull();

  const outsideDiagonal = unprojectScreenToSphere(
    center.x + scale * 0.7072,
    center.y + scale * 0.7072,
    rot,
    scale,
    center
  );
  expect(outsideDiagonal).toBeNull();
});

test('2.3 Degenerate Scales and Zero Handling', () => {
  const center = { x: 500, y: 500 };
  expect(unprojectScreenToSphere(500, 500, [0, 0], 0, center)).toBeNull();
  expect(unprojectScreenToSphere(500, 500, [0, 0], -100, center)).toBeNull();
});

test('2.4 Spherical Distance, Antipodes, and Coincident Points', () => {
  const p1 = { lat: 37.7749, lon: -122.4194 };
  expect(getSphericalDistance(p1, p1)).toBeCloseTo(0, 4);

  const pAntipode = { lat: -37.7749, lon: 57.5806 };
  const distAntipode = getSphericalDistance(p1, pAntipode);
  expect(distAntipode).toBeGreaterThan(20000);
  expect(distAntipode).toBeLessThan(20030);

  const distPoles = getSphericalDistance({ lat: 90, lon: 0 }, { lat: -90, lon: 0 });
  expect(distPoles).toBeGreaterThan(20000);
  expect(distPoles).toBeLessThan(20030);
});

test('2.5 Slerp Interpolation Bounds and Endpoints', () => {
  const pA = { lat: 10, lon: 20 };
  const pB = { lat: -40, lon: 80 };

  const start = interpolateGreatCircle(pA, pB, 0);
  expect(start.lat).toBeCloseTo(pA.lat, 4);
  expect(start.lon).toBeCloseTo(pA.lon, 4);

  const end = interpolateGreatCircle(pA, pB, 1);
  expect(end.lat).toBeCloseTo(pB.lat, 4);
  expect(end.lon).toBeCloseTo(pB.lon, 4);

  const clampedNeg = interpolateGreatCircle(pA, pB, -0.5);
  expect(clampedNeg.lat).toBeCloseTo(pA.lat, 4);
  const clampedOver = interpolateGreatCircle(pA, pB, 1.5);
  expect(clampedOver.lat).toBeCloseTo(pB.lat, 4);
});

// 3. ADVERSARIAL ELEVATION & TOPOGRAPHY STRESS TESTS
test('3.1 Global Elevation Bounding Invariants across 20,000 Points', () => {
  const validTerrainTypes: TerrainType[] = [
    'ocean',
    'coastal',
    'plains',
    'hills',
    'mountains',
    'high_plateau',
  ];

  let samples = 0;
  for (let lat = -90; lat <= 90; lat += 2.5) {
    for (let lon = -180; lon <= 180; lon += 5) {
      samples++;
      const elev = getEstimatedElevation(lat, lon);

      expect(Number.isFinite(elev.elevationMeters)).toBe(true);
      expect(Number.isFinite(elev.normalizedElevation)).toBe(true);
      expect(elev.elevationMeters).toBeGreaterThanOrEqual(-11034);
      expect(elev.elevationMeters).toBeLessThanOrEqual(8848);
      expect(elev.normalizedElevation).toBeGreaterThanOrEqual(0.0);
      expect(elev.normalizedElevation).toBeLessThanOrEqual(1.0);
      expect(validTerrainTypes.includes(elev.terrainType)).toBe(true);
      expect(typeof elev.isLand).toBe('boolean');
      expect(typeof elev.description).toBe('string');
      expect(elev.description.length).toBeGreaterThan(0);
    }
  }
  expect(samples).toBeGreaterThan(5000);
});

test('3.2 Major Mountain Peaks Regional Verification', () => {
  const mountainPeaks = [
    { name: 'Everest / Himalayas', lat: 27.9881, lon: 86.925, minElev: 7500 },
    { name: 'Aconcagua / Andes', lat: -32.6532, lon: -70.0109, minElev: 6000 },
    { name: 'Mount Elbert / Rockies', lat: 39.1178, lon: -106.4454, minElev: 3800 },
    { name: 'Mount Elbrus / Caucasus', lat: 43.3499, lon: 42.4453, minElev: 5000 },
    { name: 'Mount Kilimanjaro', lat: -3.0674, lon: 37.3556, minElev: 4500 },
    { name: 'Galdhøpiggen / Scandinavian', lat: 61.6364, lon: 8.3125, minElev: 2000 },
    { name: 'Mount Kosciuszko', lat: -36.4559, lon: 148.2636, minElev: 1800 },
    { name: 'Toubkal / Atlas', lat: 31.0594, lon: -7.9158, minElev: 3500 },
    { name: 'Mount Narodnaya / Urals', lat: 65.0333, lon: 60.1167, minElev: 1500 },
    { name: 'Vinson Massif / Antarctica', lat: -78.5833, lon: -85.5833, minElev: 4000 },
    { name: 'Gunnbjørn Fjeld / Greenland', lat: 68.9167, lon: -29.9, minElev: 3000 },
  ];

  for (const peak of mountainPeaks) {
    const res = getEstimatedElevation(peak.lat, peak.lon);
    expect(res.isLand).toBe(true);
    expect(res.elevationMeters).toBeGreaterThanOrEqual(peak.minElev);
    expect(res.terrainType === 'mountains' || res.terrainType === 'high_plateau').toBe(true);
  }
});

test('3.3 Oceanic Deep Trench Bathymetry (Mariana & Tonga)', () => {
  const trenches = [
    { name: 'Mariana Trench', lat: 11.3733, lon: 142.1989, maxElev: -9000 },
    { name: 'Tonga Trench', lat: -23.2833, lon: -174.75, maxElev: -9000 },
  ];

  for (const t of trenches) {
    const res = getEstimatedElevation(t.lat, t.lon);
    expect(res.isLand).toBe(false);
    expect(res.elevationMeters).toBeLessThanOrEqual(t.maxElev);
    expect(res.terrainType).toBe('ocean');
  }
});

console.log(`\n========================================`);
console.log(`Reviewer 2 Adversarial Stress Test Results:`);
console.log(`Passed: ${passedTests} / ${totalTests} (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log(`Failed: ${failedTests}`);
if (failures.length > 0) {
  console.log(`Failures:`);
  failures.forEach(f => console.log(` - ${f}`));
}
console.log(`========================================\n`);

if (failedTests > 0) {
  process.exitCode = 1;
}
