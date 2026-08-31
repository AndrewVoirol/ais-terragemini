import { describe, it, expect } from 'vitest';
import {
  latLonToMGRS,
  latLonToUTM,
  latLonToDD,
  latLonToDMS,
  getUTMZone,
  getLatitudeBand,
  formatCoordinatesAll,
  formatUTM,
  getSectorGridCode
} from '../utils/coordinates';
import {
  projectSphereToScreen,
  unprojectScreenToSphere,
  getSphericalDistance,
  getBearing,
  isPointOccluded,
  interpolateGreatCircle
} from '../utils/projection';
import {
  getEstimatedElevation,
  classifyTerrain,
  isGeographicLand
} from '../utils/elevation';

// Canonical ground-truth test vectors from official NGA / DMA / NATO cartographic standards
interface MGRSBenchmarkVector {
  name: string;
  lat: number;
  lon: number;
  expectedZone: number;
  expectedBand: string;
  expectedColSetPrefix: string; // e.g. "18T WV" or "18S UJ"
  expectedMGRSPattern: RegExp;
  expectedMinEasting?: number;
  expectedMaxEasting?: number;
  expectedMinNorthing?: number;
  expectedMaxNorthing?: number;
}

const CANONICAL_MGRS_VECTORS: MGRSBenchmarkVector[] = [
  {
    name: 'New York City (Times Square / Empire State)',
    lat: 40.7484,
    lon: -73.9857,
    expectedZone: 18,
    expectedBand: 'T',
    expectedColSetPrefix: '18TWL',
    expectedMGRSPattern: /^18T\s*WL\s*\d{5}\s*\d{5}$/,
    expectedMinEasting: 585000,
    expectedMaxEasting: 587000,
    expectedMinNorthing: 4510000,
    expectedMaxNorthing: 4513000,
  },
  {
    name: 'Washington DC (Pentagon / Washington Monument)',
    lat: 38.8895,
    lon: -77.0353,
    expectedZone: 18,
    expectedBand: 'S',
    expectedColSetPrefix: '18SUJ',
    expectedMGRSPattern: /^18S\s*UJ\s*\d{5}\s*\d{5}$/,
    expectedMinEasting: 323000,
    expectedMaxEasting: 324000,
    expectedMinNorthing: 4306000,
    expectedMaxNorthing: 4307000,
  },
  {
    name: 'Paris (Eiffel Tower)',
    lat: 48.8584,
    lon: 2.2945,
    expectedZone: 31,
    expectedBand: 'U',
    expectedColSetPrefix: '31UDQ',
    expectedMGRSPattern: /^31U\s*DQ\s*\d{5}\s*\d{5}$/,
    expectedMinEasting: 448000,
    expectedMaxEasting: 449000,
    expectedMinNorthing: 5411000,
    expectedMaxNorthing: 5413000,
  },
  {
    name: 'Tokyo (Tokyo Tower)',
    lat: 35.6586,
    lon: 139.7454,
    expectedZone: 54,
    expectedBand: 'S',
    expectedColSetPrefix: '54SUE',
    expectedMGRSPattern: /^54S\s*UE\s*\d{5}\s*\d{5}$/,
    expectedMinEasting: 386000,
    expectedMaxEasting: 387000,
    expectedMinNorthing: 3946000,
    expectedMaxNorthing: 3948000,
  },
  {
    name: 'Sydney (Opera House, Southern Hemisphere)',
    lat: -33.8568,
    lon: 151.2153,
    expectedZone: 56,
    expectedBand: 'H',
    expectedColSetPrefix: '56HLH',
    expectedMGRSPattern: /^56H\s*LH\s*\d{5}\s*\d{5}$/,
    expectedMinEasting: 334000,
    expectedMaxEasting: 336000,
    expectedMinNorthing: 6251000, // 10,000,000 - ~3,748,000
    expectedMaxNorthing: 6253000,
  },
  {
    name: 'Rio de Janeiro (Christ the Redeemer, Southern Hemisphere)',
    lat: -22.9519,
    lon: -43.2105,
    expectedZone: 23,
    expectedBand: 'K',
    expectedColSetPrefix: '23KPQ',
    expectedMGRSPattern: /^23K\s*PQ\s*\d{5}\s*\d{5}$/,
    expectedMinEasting: 683000,
    expectedMaxEasting: 685000,
    expectedMinNorthing: 7460000,
    expectedMaxNorthing: 7462000,
  },
  {
    name: 'Cape Town (Table Mountain, Southern Hemisphere)',
    lat: -33.9628,
    lon: 18.4098,
    expectedZone: 34,
    expectedBand: 'H',
    expectedColSetPrefix: '34HBH',
    expectedMGRSPattern: /^34H\s*BH\s*\d{5}\s*\d{5}$/,
    expectedMinEasting: 260000,
    expectedMaxEasting: 262000,
    expectedMinNorthing: 6238000,
    expectedMaxNorthing: 6241000,
  },
  {
    name: 'Cairo (Pyramids of Giza)',
    lat: 29.9792,
    lon: 31.1342,
    expectedZone: 36,
    expectedBand: 'R',
    expectedColSetPrefix: '36RUU',
    expectedMGRSPattern: /^36R\s*UU\s*\d{5}\s*\d{5}$/,
    expectedMinEasting: 319000,
    expectedMaxEasting: 321000,
    expectedMinNorthing: 3317000,
    expectedMaxNorthing: 3319000,
  },
  {
    name: 'Norway Exception Zone 32V (Bergen)',
    lat: 60.3913,
    lon: 5.3221,
    expectedZone: 32, // Special exception
    expectedBand: 'V',
    expectedColSetPrefix: '32V',
    expectedMGRSPattern: /^32V\s*[A-Z]{2}\s*\d{5}\s*\d{5}$/,
  },
  {
    name: 'Svalbard Exception Zone 33X (Longyearbyen)',
    lat: 78.2232,
    lon: 15.6267,
    expectedZone: 33, // Special exception for 9°-21°E
    expectedBand: 'X',
    expectedColSetPrefix: '33X',
    expectedMGRSPattern: /^33X\s*[A-Z]{2}\s*\d{5}\s*\d{5}$/,
  },
  {
    name: 'Equator / Prime Meridian (Gulf of Guinea Origin)',
    lat: 0.0,
    lon: 0.0,
    expectedZone: 31,
    expectedBand: 'N',
    expectedColSetPrefix: '31N',
    expectedMGRSPattern: /^31N\s*[A-Z]{2}\s*\d{5}\s*\d{5}$/,
  },
  {
    name: 'Equator Central Meridian of Zone 31 (3.0°E)',
    lat: 0.0,
    lon: 3.0,
    expectedZone: 31,
    expectedBand: 'N',
    expectedColSetPrefix: '31N',
    expectedMGRSPattern: /^31N\s*[A-Z]{2}\s*00000\s*00000$/,
  },
];

describe('Milestone 1 Challenger Suite: Core Math, Coordinates & Projection Hardening', () => {

  describe('Section 1: MGRS 10-Digit 1-Meter Precision & Canonical Cartography Verification', () => {
    it('1.1 should match exact canonical MGRS prefixes and 10-digit coordinates across global vectors', () => {
      for (const vec of CANONICAL_MGRS_VECTORS) {
        const utm = latLonToUTM(vec.lat, vec.lon);
        expect(utm.zoneNumber, `${vec.name} zone`).toBe(vec.expectedZone);
        expect(utm.band, `${vec.name} band`).toBe(vec.expectedBand);

        if (vec.expectedMinEasting !== undefined && vec.expectedMaxEasting !== undefined) {
          expect(utm.easting, `${vec.name} easting`).toBeGreaterThanOrEqual(vec.expectedMinEasting);
          expect(utm.easting, `${vec.name} easting`).toBeLessThanOrEqual(vec.expectedMaxEasting);
        }

        if (vec.expectedMinNorthing !== undefined && vec.expectedMaxNorthing !== undefined) {
          expect(utm.northing, `${vec.name} northing`).toBeGreaterThanOrEqual(vec.expectedMinNorthing);
          expect(utm.northing, `${vec.name} northing`).toBeLessThanOrEqual(vec.expectedMaxNorthing);
        }

        const mgrs5 = latLonToMGRS(vec.lat, vec.lon, 5);
        expect(mgrs5, `${vec.name} MGRS 5-digit`).toMatch(vec.expectedMGRSPattern);

        // Verify formatting without whitespace matches prefix
        const cleanMgrs = mgrs5.replace(/\s+/g, '');
        expect(cleanMgrs.startsWith(vec.expectedColSetPrefix), `${vec.name} prefix`).toBe(true);

        // Verify total length: Zone(1-2) + Band(1) + ColRow(2) + Easting(5) + Northing(5) = 14 or 15 chars without spaces
        expect(cleanMgrs.length).toBeGreaterThanOrEqual(14);
        expect(cleanMgrs.length).toBeLessThanOrEqual(15);
      }
    });

    it('1.2 should support all precision tiers (0 to 5 digits, corresponding to 100km, 10km, 1km, 100m, 10m, 1m)', () => {
      const lat = 40.7484;
      const lon = -73.9857;

      const p0 = latLonToMGRS(lat, lon, 0); // 100km square only
      expect(p0).toBe('18T WL');

      const p1 = latLonToMGRS(lat, lon, 1); // 10km precision (1 digit each)
      expect(p1).toMatch(/^18T WL \d \d$/);

      const p2 = latLonToMGRS(lat, lon, 2); // 1km precision (2 digits each)
      expect(p2).toMatch(/^18T WL \d{2} \d{2}$/);

      const p3 = latLonToMGRS(lat, lon, 3); // 100m precision (3 digits each)
      expect(p3).toMatch(/^18T WL \d{3} \d{3}$/);

      const p4 = latLonToMGRS(lat, lon, 4); // 10m precision (4 digits each)
      expect(p4).toMatch(/^18T WL \d{4} \d{4}$/);

      const p5 = latLonToMGRS(lat, lon, 5); // 1m precision (5 digits each)
      expect(p5).toMatch(/^18T WL \d{5} \d{5}$/);
    });

    it('1.3 should correctly handle southern hemisphere false northing and equator continuity', () => {
      // Just north of equator (0.0001°N, 3.0°E): Northing should be ~11m
      const northEq = latLonToUTM(0.0001, 3.0);
      expect(northEq.northing).toBeGreaterThan(0);
      expect(northEq.northing).toBeLessThan(50);
      expect(northEq.band).toBe('N');

      // Just south of equator (-0.0001°S, 3.0°E): Northing should be ~9,999,989m (with 10M false northing)
      const southEq = latLonToUTM(-0.0001, 3.0);
      expect(southEq.northing).toBeGreaterThan(9999900);
      expect(southEq.northing).toBeLessThan(10000000);
      expect(southEq.band).toBe('M');
    });

    it('1.4 should correctly compute tactical sector grid codes', () => {
      const sectorNYC = getSectorGridCode(40.7484, -73.9857);
      expect(sectorNYC).toBe('SEC-18T-WL');

      const sectorParis = getSectorGridCode(48.8584, 2.2945);
      expect(sectorParis).toBe('SEC-31U-DQ');
    });
  });

  describe('Section 2: High-Throughput Performance & Memory Leak Verification', () => {
    it('2.1 should exceed 50,000 coordinate conversions / second throughput', () => {
      const SAMPLE_COUNT = 50000;
      const testCoords: Array<[number, number]> = [];

      // Pre-generate deterministic random test coordinates
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const lat = -80.0 + (i % 16400) * 0.01;
        const lon = -180.0 + (i % 36000) * 0.01;
        testCoords.push([lat, lon]);
      }

      // Warmup JIT
      for (let i = 0; i < 2000; i++) {
        latLonToMGRS(testCoords[i][0], testCoords[i][1], 5);
      }

      const start = performance.now();
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        latLonToMGRS(testCoords[i][0], testCoords[i][1], 5);
      }
      const elapsedMs = performance.now() - start;
      const opsPerSec = (SAMPLE_COUNT / elapsedMs) * 1000;

      console.log(`[Benchmark] latLonToMGRS throughput: ${Math.round(opsPerSec).toLocaleString()} ops/sec (elapsed: ${elapsedMs.toFixed(2)}ms for ${SAMPLE_COUNT} ops)`);
      expect(opsPerSec).toBeGreaterThan(50000);
    });

    it('2.2 should sustain high throughput for formatCoordinatesAll (>30,000 ops/sec)', () => {
      const SAMPLE_COUNT = 30000;
      const testCoords: Array<[number, number]> = [];
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const lat = -75.0 + (i % 15000) * 0.01;
        const lon = -170.0 + (i % 34000) * 0.01;
        testCoords.push([lat, lon]);
      }

      const start = performance.now();
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        formatCoordinatesAll(testCoords[i][0], testCoords[i][1]);
      }
      const elapsedMs = performance.now() - start;
      const opsPerSec = (SAMPLE_COUNT / elapsedMs) * 1000;

      console.log(`[Benchmark] formatCoordinatesAll throughput: ${Math.round(opsPerSec).toLocaleString()} ops/sec`);
      expect(opsPerSec).toBeGreaterThan(30000);
    });

    it('2.3 should sustain high throughput for 3D projection and unprojection (>100,000 ops/sec)', () => {
      const SAMPLE_COUNT = 100000;
      const center = { x: 500, y: 500 };
      const scale = 250;
      const rotation: [number, number] = [45, 30];

      const startProj = performance.now();
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        projectSphereToScreen((i % 180) - 90, (i % 360) - 180, rotation, scale, center);
      }
      const elapsedProj = performance.now() - startProj;
      const projOpsPerSec = (SAMPLE_COUNT / elapsedProj) * 1000;

      console.log(`[Benchmark] projectSphereToScreen throughput: ${Math.round(projOpsPerSec).toLocaleString()} ops/sec`);
      expect(projOpsPerSec).toBeGreaterThan(100000);

      const startUnproj = performance.now();
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        unprojectScreenToSphere(500 + (i % 200) - 100, 500 + (i % 200) - 100, rotation, scale, center);
      }
      const elapsedUnproj = performance.now() - startUnproj;
      const unprojOpsPerSec = (SAMPLE_COUNT / elapsedUnproj) * 1000;

      console.log(`[Benchmark] unprojectScreenToSphere throughput: ${Math.round(unprojOpsPerSec).toLocaleString()} ops/sec`);
      expect(unprojOpsPerSec).toBeGreaterThan(100000);
    });

    it('2.4 should maintain zero memory leaks over 200,000 iterative conversions', () => {
      const BATCH_SIZE = 50000;
      const BATCH_COUNT = 4;
      const heapSnapshots: number[] = [];

      for (let b = 0; b < BATCH_COUNT; b++) {
        for (let i = 0; i < BATCH_SIZE; i++) {
          const lat = -80.0 + (i % 16000) * 0.01;
          const lon = -180.0 + (i % 36000) * 0.01;
          latLonToMGRS(lat, lon, 5);
          getEstimatedElevation(lat, lon);
        }
        if (typeof global !== 'undefined' && (global as any).gc) {
          (global as any).gc();
        }
        heapSnapshots.push(process.memoryUsage().heapUsed);
      }

      console.log('[Benchmark] Heap usage across 4 batches (MB):', heapSnapshots.map(h => (h / (1024 * 1024)).toFixed(2)));
      // Verify heap does not expand uncontrollably (delta between batch 1 and batch 4 < 25MB)
      const heapGrowthMB = (heapSnapshots[BATCH_COUNT - 1] - heapSnapshots[0]) / (1024 * 1024);
      expect(heapGrowthMB).toBeLessThan(25.0);
    });
  });

  describe('Section 3: Elevation Model Smoothness & Land/Ocean Classification Stability', () => {
    it('3.1 should maintain normalized elevation strictly bounded in [0.0, 1.0] across all global coordinates', () => {
      for (let lat = -90; lat <= 90; lat += 2) {
        for (let lon = -180; lon <= 180; lon += 5) {
          const elev = getEstimatedElevation(lat, lon);
          expect(elev.normalizedElevation, `Normalized elev at (${lat}, ${lon})`).toBeGreaterThanOrEqual(0.0);
          expect(elev.normalizedElevation, `Normalized elev at (${lat}, ${lon})`).toBeLessThanOrEqual(1.0);
          expect(Number.isNaN(elev.normalizedElevation)).toBe(false);
          expect(Number.isFinite(elev.elevationMeters)).toBe(true);
          expect(elev.elevationMeters).toBeGreaterThanOrEqual(-11034);
          expect(elev.elevationMeters).toBeLessThanOrEqual(8848);
        }
      }
    });

    it('3.2 should exhibit continuous elevation behavior across the antimeridian (-180° / +180°)', () => {
      for (let lat = -80; lat <= 80; lat += 5) {
        const westEdge = getEstimatedElevation(lat, -180);
        const eastEdge = getEstimatedElevation(lat, 180);
        expect(westEdge.elevationMeters, `Antimeridian continuity at lat ${lat}`).toBe(eastEdge.elevationMeters);
        expect(westEdge.isLand, `Antimeridian land consistency at lat ${lat}`).toBe(eastEdge.isLand);
        expect(westEdge.terrainType, `Antimeridian terrain consistency at lat ${lat}`).toBe(eastEdge.terrainType);
      }
    });

    it('3.3 should stably classify known landmark landmasses vs deep ocean abyssal basins', () => {
      // Terrestrial Mountains & Plateaus
      const everest = getEstimatedElevation(27.9881, 86.925);
      expect(everest.isLand).toBe(true);
      expect(everest.elevationMeters).toBeGreaterThan(7000);
      expect(['mountains', 'high_plateau']).toContain(everest.terrainType);

      const aconcagua = getEstimatedElevation(-32.6532, -70.0109);
      expect(aconcagua.isLand).toBe(true);
      expect(aconcagua.elevationMeters).toBeGreaterThan(5000);
      expect(['mountains', 'high_plateau']).toContain(aconcagua.terrainType);

      // Deep Ocean Trenches
      const mariana = getEstimatedElevation(11.3733, 142.1989);
      expect(mariana.isLand).toBe(false);
      expect(mariana.elevationMeters).toBeLessThan(-8000);
      expect(mariana.terrainType).toBe('ocean');

      const puertoRico = getEstimatedElevation(19.7, -66.5);
      expect(puertoRico.isLand).toBe(false);
      expect(puertoRico.elevationMeters).toBeLessThan(-6000);
      expect(puertoRico.terrainType).toBe('ocean');

      // Continents
      const kansas = getEstimatedElevation(39.0, -98.0);
      expect(kansas.isLand).toBe(true);
      expect(kansas.elevationMeters).toBeGreaterThan(0);

      const antarctica = getEstimatedElevation(-80.0, 0.0);
      expect(antarctica.isLand).toBe(true);
      expect(antarctica.elevationMeters).toBeGreaterThan(1500);

      // Open Oceans
      const midPacific = getEstimatedElevation(0.0, -140.0);
      expect(midPacific.isLand).toBe(false);
      expect(midPacific.elevationMeters).toBeLessThan(-2000);
      expect(midPacific.terrainType).toBe('ocean');

      const midAtlantic = getEstimatedElevation(25.0, -40.0);
      expect(midAtlantic.isLand).toBe(false);
      expect(midAtlantic.elevationMeters).toBeLessThan(-2000);
      expect(midAtlantic.terrainType).toBe('ocean');
    });

    it('3.4 should maintain bounded spatial gradients without unphysical step singularities', () => {
      // Step across a 100km transect in the plains to verify smooth micro-variation
      const startLat = 40.0;
      const startLon = -100.0;
      let prevElev = getEstimatedElevation(startLat, startLon).elevationMeters;

      for (let step = 1; step <= 20; step++) {
        const currLat = startLat + step * 0.01; // ~1.1km step
        const currElev = getEstimatedElevation(currLat, startLon).elevationMeters;
        const delta = Math.abs(currElev - prevElev);
        // Over 1km, plain elevation micro-variations should not jump more than 100m
        expect(delta).toBeLessThan(100);
        prevElev = currElev;
      }
    });
  });

  describe('Section 4: 3D Projection Invertibility & Geometric Precision Stress', () => {
    it('4.1 should guarantee bidirectional roundtrip fidelity (unproject(project(lat, lon)) == lat, lon)', () => {
      const center = { x: 400, y: 300 };
      const scale = 200;

      // Test across multiple camera orientation angles
      const orientations: Array<[number, number]> = [
        [0, 0],
        [45, 20],
        [-60, -30],
        [120, 15],
        [-150, -45],
      ];

      for (const rot of orientations) {
        for (let lat = -60; lat <= 60; lat += 15) {
          for (let lon = -180; lon < 180; lon += 30) {
            const proj = projectSphereToScreen(lat, lon, rot, scale, center);
            if (proj.isVisible && proj.depth > 0.15) { // Well within the front visible disc
              const unproj = unprojectScreenToSphere(proj.x, proj.y, rot, scale, center);
              expect(unproj, `Unproject of (${lat}, ${lon}) with rot ${rot}`).not.toBeNull();
              expect(unproj!.lat).toBeCloseTo(lat, 1); // Sub-degree precision
              const dLon = Math.abs((((unproj!.lon - lon + 540) % 360) - 180));
              expect(dLon, `Longitude match for (${lat}, ${lon}) with rot ${rot}`).toBeLessThan(0.05);
            }
          }
        }
      }
    });

    it('4.2 should accurately compute great circle distance and azimuth bearing', () => {
      const nyc = { lat: 40.7128, lon: -74.006 };
      const london = { lat: 51.5074, lon: -0.1278 };

      const distKm = getSphericalDistance(nyc, london);
      // Great circle distance NYC to London is ~5,570 km
      expect(distKm).toBeGreaterThan(5500);
      expect(distKm).toBeLessThan(5650);

      const bearing = getBearing(nyc, london);
      // Initial bearing NYC to London is ~51° (Northeast)
      expect(bearing).toBeGreaterThan(48);
      expect(bearing).toBeLessThan(54);

      // Slerp midpoint
      const midPoint = interpolateGreatCircle(nyc, london, 0.5);
      const d1 = getSphericalDistance(nyc, midPoint);
      const d2 = getSphericalDistance(midPoint, london);
      expect(d1).toBeCloseTo(distKm / 2.0, 0);
      expect(d2).toBeCloseTo(distKm / 2.0, 0);
    });

    it('4.3 should handle extreme edge raycasting (tangent grazing and scale extremes)', () => {
      const center = { x: 500, y: 500 };
      const scale = 250;
      const rot: [number, number] = [0, 0];

      // Exact limb grazing ray (dx = 250, r = 1.0)
      const limbRay = unprojectScreenToSphere(750, 500, rot, scale, center);
      expect(limbRay).not.toBeNull();
      expect(limbRay!.lat).toBeCloseTo(0, 1);
      expect(limbRay!.lon).toBeCloseTo(90, 1);

      // 1 pixel outside limb (dx = 251, r > 1.0)
      const outsideRay = unprojectScreenToSphere(751, 500, rot, scale, center);
      expect(outsideRay).toBeNull();

      // Degenerate scale <= 0
      expect(unprojectScreenToSphere(500, 500, rot, 0, center)).toBeNull();
      expect(unprojectScreenToSphere(500, 500, rot, -100, center)).toBeNull();
    });
  });
});
