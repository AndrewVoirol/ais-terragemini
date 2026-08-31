import { describe, it, expect } from 'vitest';
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
import { Coordinates } from '../types';

describe('Adversarial Stress & Edge Case Verification Suite (Milestone 1)', () => {
  // =========================================================================
  // 1. COORDINATE ENGINE ADVERSARIAL TESTS
  // =========================================================================
  describe('1. Coordinate Engine Stress & Boundary Tests', () => {
    it('1.1 UTM Zone transitions along all 60 longitudinal boundaries', () => {
      for (let zone = 1; zone <= 60; zone++) {
        const westBoundary = (zone - 1) * 6 - 180;
        const centralMeridian = westBoundary + 3;
        const eastBoundary = westBoundary + 6;

        const eps = 0.00001;

        // Point just east of west boundary (inside zone)
        const insideWest = getUTMZone(0, westBoundary + eps);
        expect(insideWest).toBe(zone);

        // Central meridian (inside zone)
        const insideCM = getUTMZone(0, centralMeridian);
        expect(insideCM).toBe(zone);

        // Point just west of east boundary (inside zone)
        const insideEast = getUTMZone(0, eastBoundary - eps);
        expect(insideEast).toBe(zone);
      }
    });

    it('1.2 UTM Zone special exceptions (Norway and Svalbard)', () => {
      // Norway: lat [56, 64), lon [3, 12) -> should always be Zone 32
      expect(getUTMZone(56.0, 3.0)).toBe(32);
      expect(getUTMZone(60.0, 4.0)).toBe(32);
      expect(getUTMZone(63.999, 11.999)).toBe(32);

      // Just outside Norway boundaries
      expect(getUTMZone(55.999, 4.0)).toBe(31);
      expect(getUTMZone(64.001, 4.0)).toBe(31);
      expect(getUTMZone(60.0, 2.999)).toBe(31);
      expect(getUTMZone(60.0, 12.001)).toBe(33);

      // Svalbard: lat [72, 84)
      expect(getUTMZone(75.0, 0.0)).toBe(31);
      expect(getUTMZone(75.0, 8.999)).toBe(31);
      expect(getUTMZone(75.0, 9.0)).toBe(33);
      expect(getUTMZone(75.0, 20.999)).toBe(33);
      expect(getUTMZone(75.0, 21.0)).toBe(35);
      expect(getUTMZone(75.0, 32.999)).toBe(35);
      expect(getUTMZone(75.0, 33.0)).toBe(37);
      expect(getUTMZone(75.0, 41.999)).toBe(37);
    });

    it('1.3 Latitude Band boundaries and letter omissions', () => {
      const forbiddenLetters = ['I', 'O', 'Y', 'Z', 'A', 'B'];

      for (let lat = -80; lat <= 84; lat += 0.5) {
        const band = getLatitudeBand(lat);
        expect(band.length).toBe(1);
        for (const forbidden of forbiddenLetters) {
          expect(band).not.toBe(forbidden);
        }
      }

      expect(getLatitudeBand(-80.0)).toBe('C');
      expect(getLatitudeBand(-79.9)).toBe('C');
      expect(getLatitudeBand(-72.0)).toBe('D');
      expect(getLatitudeBand(0.0)).toBe('N');
      expect(getLatitudeBand(71.99)).toBe('W');
      expect(getLatitudeBand(72.0)).toBe('X');
      expect(getLatitudeBand(83.99)).toBe('X');
      expect(getLatitudeBand(84.0)).toBe('X');

      // Beyond UTM coverage (clamped safely)
      expect(getLatitudeBand(-89.9)).toBe('C');
      expect(getLatitudeBand(-90.0)).toBe('C');
      expect(getLatitudeBand(85.0)).toBe('X');
      expect(getLatitudeBand(90.0)).toBe('X');
    });

    it('1.4 UTM Central Meridian False Easting invariants', () => {
      for (let zone = 1; zone <= 60; zone++) {
        const cmLon = (zone - 1) * 6 - 180 + 3;
        const utm = latLonToUTM(0.0, cmLon);

        expect(utm.zoneNumber).toBe(zone);
        expect(Math.abs(utm.easting - 500000.0)).toBeLessThan(1.0);
        expect(Math.abs(utm.northing)).toBeLessThan(1.0);
      }
    });

    it('1.5 UTM Southern Hemisphere False Northing invariant', () => {
      const southOfEquator = latLonToUTM(-0.00001, 3.0);
      expect(southOfEquator.northing).toBeCloseTo(10000000.0, -1);

      const northOfEquator = latLonToUTM(0.00001, 3.0);
      expect(northOfEquator.northing).toBeCloseTo(0.0, -1);
    });

    it('1.6 Extreme Polar and Antimeridian UTM stability', () => {
      const northPole = latLonToUTM(90.0, 0.0);
      expect(Number.isFinite(northPole.easting)).toBe(true);
      expect(Number.isFinite(northPole.northing)).toBe(true);
      expect(northPole.band).toBe('X');

      const southPole = latLonToUTM(-90.0, 0.0);
      expect(Number.isFinite(southPole.easting)).toBe(true);
      expect(Number.isFinite(southPole.northing)).toBe(true);
      expect(southPole.band).toBe('C');

      const antimeridianPos = latLonToUTM(0.0, 180.0);
      expect(Number.isFinite(antimeridianPos.easting)).toBe(true);
      expect(Number.isFinite(antimeridianPos.northing)).toBe(true);

      const antimeridianNeg = latLonToUTM(0.0, -180.0);
      expect(Number.isFinite(antimeridianNeg.easting)).toBe(true);
      expect(Number.isFinite(antimeridianNeg.northing)).toBe(true);
    });

    it('1.7 MGRS Grid Square Letters and Precision Tiers', () => {
      const testPoints: Coordinates[] = [
        { lat: 40.7128, lon: -74.006 }, // NYC
        { lat: 35.6762, lon: 139.6503 }, // Tokyo
        { lat: 48.8566, lon: 2.3522 }, // Paris
        { lat: -33.8688, lon: 151.2093 }, // Sydney
        { lat: 30.0444, lon: 31.2357 }, // Cairo
        { lat: 51.5074, lon: -0.1278 }, // London
        { lat: -22.9068, lon: -43.1729 }, // Rio
        { lat: 55.7558, lon: 37.6173 }, // Moscow
        { lat: -34.6037, lon: -58.3816 }, // Buenos Aires
        { lat: 1.3521, lon: 103.8198 }, // Singapore
        { lat: 64.1466, lon: -21.9426 }, // Reykjavik
        { lat: -33.9249, lon: 18.4241 }, // Cape Town
      ];

      for (const pt of testPoints) {
        for (let p = 0; p <= 5; p++) {
          const mgrs = latLonToMGRS(pt.lat, pt.lon, p);
          expect(mgrs).not.toContain('I');
          expect(mgrs).not.toContain('O');

          const parts = mgrs.split(' ');
          if (p === 0) {
            expect(parts.length).toBe(2);
          } else {
            expect(parts.length).toBe(4);
            expect(parts[2].length).toBe(p);
            expect(parts[3].length).toBe(p);
          }
        }
      }
    });

    it('1.8 DD and DMS formatters handle edge coordinates without NaN', () => {
      const edgeCoords = [
        { lat: 0, lon: 0 },
        { lat: 90, lon: 180 },
        { lat: -90, lon: -180 },
        { lat: 0.0000001, lon: -0.0000001 },
        { lat: 89.999999, lon: 179.999999 },
      ];

      for (const c of edgeCoords) {
        const dd = latLonToDD(c.lat, c.lon);
        expect(dd).not.toContain('NaN');
        expect(dd).toMatch(/° (N|S), .*° (E|W)/);

        const dms = latLonToDMS(c.lat, c.lon);
        expect(dms).not.toContain('NaN');
        expect(dms).toMatch(/\d{2}° \d{2}' \d{2}\.\d" (N|S), \d{3}° \d{2}' \d{2}\.\d" (E|W)/);
      }
    });
  });

  // =========================================================================
  // 2. 3D PROJECTION & RAYCASTING ADVERSARIAL TESTS
  // =========================================================================
  describe('2. 3D Spherical Projection & Inverse Raycasting Oracles', () => {
    it('2.1 High-precision unproject <-> project roundtrips across 1,000 random spherical points', () => {
      const scale = 300;
      const center = { x: 400, y: 300 };
      const numPoints = 1000;
      const phi = (1 + Math.sqrt(5)) / 2;

      let maxLatDelta = 0;
      let maxLonDelta = 0;
      let testedCount = 0;

      for (let i = 0; i < numPoints; i++) {
        const y = 1 - (i / (numPoints - 1)) * 2;
        const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = (2 * Math.PI * i) / phi;

        const lat = Math.asin(y) * (180 / Math.PI);
        let lon = ((theta * (180 / Math.PI)) % 360);
        if (lon > 180) lon -= 360;
        if (lon < -180) lon += 360;

        const yaw = ((i * 37) % 360) - 180;
        const pitch = ((i * 19) % 160) - 80;
        const rotation: [number, number] = [yaw, pitch];

        const proj = projectSphereToScreen(lat, lon, rotation, scale, center);

        if (proj.isVisible) {
          testedCount++;
          const unproj = unprojectScreenToSphere(proj.x, proj.y, rotation, scale, center);
          expect(unproj).not.toBeNull();

          if (unproj) {
            const dLat = Math.abs(unproj.lat - lat);
            let dLon = Math.abs(unproj.lon - lon);
            if (dLon > 180) dLon = Math.abs(dLon - 360);

            if (Math.abs(lat) > 89.99) {
              expect(dLat).toBeLessThan(1e-4);
            } else {
              expect(dLat).toBeLessThan(1e-4);
              expect(dLon).toBeLessThan(1e-3);
            }

            if (dLat > maxLatDelta) maxLatDelta = dLat;
            if (dLon > maxLonDelta && Math.abs(lat) < 85) maxLonDelta = dLon;
          }
        }
      }

      expect(testedCount).toBeGreaterThan(400);
      expect(maxLatDelta).toBeLessThan(1e-4);
      expect(maxLonDelta).toBeLessThan(1e-3);
    });

    it('2.2 Boundary raycasting tangent to the sphere perimeter (r = scale)', () => {
      const center = { x: 500, y: 500 };
      const scale = 250;
      const rotation: [number, number] = [0, 0];

      const eastRim = unprojectScreenToSphere(center.x + scale, center.y, rotation, scale, center);
      expect(eastRim).not.toBeNull();
      expect(eastRim!.lat).toBeCloseTo(0, 1);
      expect(eastRim!.lon).toBeCloseTo(90, 1);

      const westRim = unprojectScreenToSphere(center.x - scale, center.y, rotation, scale, center);
      expect(westRim).not.toBeNull();
      expect(westRim!.lat).toBeCloseTo(0, 1);
      expect(westRim!.lon).toBeCloseTo(-90, 1);

      const northRim = unprojectScreenToSphere(center.x, center.y - scale, rotation, scale, center);
      expect(northRim).not.toBeNull();
      expect(northRim!.lat).toBeCloseTo(90, 1);

      const southRim = unprojectScreenToSphere(center.x, center.y + scale, rotation, scale, center);
      expect(southRim).not.toBeNull();
      expect(southRim!.lat).toBeCloseTo(-90, 1);

      const justOutside = unprojectScreenToSphere(center.x + scale + 0.1, center.y, rotation, scale, center);
      expect(justOutside).toBeNull();
    });

    it('2.3 Spherical distance metric properties (metric space axioms)', () => {
      const pts: Coordinates[] = [
        { lat: 40.7128, lon: -74.006 },
        { lat: 35.6762, lon: 139.6503 },
        { lat: -33.8688, lon: 151.2093 },
        { lat: 51.5074, lon: -0.1278 },
      ];

      for (let i = 0; i < pts.length; i++) {
        for (let j = 0; j < pts.length; j++) {
          const dIJ = getSphericalDistance(pts[i], pts[j]);
          expect(dIJ).toBeGreaterThanOrEqual(0);
          if (i === j) {
            expect(dIJ).toBeCloseTo(0, 5);
          } else {
            expect(dIJ).toBeGreaterThan(0);
          }
          const dJI = getSphericalDistance(pts[j], pts[i]);
          expect(dIJ).toBeCloseTo(dJI, 4);

          for (let k = 0; k < pts.length; k++) {
            const dIK = getSphericalDistance(pts[i], pts[k]);
            const dJK = getSphericalDistance(pts[j], pts[k]);
            expect(dIK).toBeLessThanOrEqual(dIJ + dJK + 1e-4);
          }
        }
      }

      const antipodalDist = getSphericalDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 180 });
      expect(antipodalDist).toBeCloseTo(Math.PI * 6371.0, 0);
    });
  });

  // =========================================================================
  // 3. ELEVATION & TERRAIN MODEL ADVERSARIAL TESTS
  // =========================================================================
  describe('3. Topographic Elevation & Terrain Classification Model', () => {
    it('3.1 Global dense coordinate grid elevation bounds [-11034m .. 8848m]', () => {
      for (let lat = -90; lat <= 90; lat += 5) {
        for (let lon = -180; lon < 180; lon += 5) {
          const elev = getEstimatedElevation(lat, lon);

          expect(Number.isFinite(elev.elevationMeters)).toBe(true);
          expect(elev.elevationMeters).toBeGreaterThanOrEqual(-11034);
          expect(elev.elevationMeters).toBeLessThanOrEqual(8848);

          expect(elev.normalizedElevation).toBeGreaterThanOrEqual(0.0);
          expect(elev.normalizedElevation).toBeLessThanOrEqual(1.0);

          expect(typeof elev.isLand).toBe('boolean');
          expect(['ocean', 'coastal', 'plains', 'hills', 'mountains', 'high_plateau']).toContain(
            elev.terrainType
          );
        }
      }
    });

    it('3.2 Specific Orographic Peaks & Oceanic Trenches sanity checks', () => {
      const everest = getEstimatedElevation(27.9881, 86.925);
      expect(everest.elevationMeters).toBeGreaterThanOrEqual(7000);
      expect(everest.terrainType).toBe('high_plateau');
      expect(everest.isLand).toBe(true);

      const aconcagua = getEstimatedElevation(-32.6532, -70.0109);
      expect(aconcagua.elevationMeters).toBeGreaterThanOrEqual(5000);
      expect(aconcagua.isLand).toBe(true);

      const denali = getEstimatedElevation(39.1178, -106.4454);
      expect(denali.elevationMeters).toBeGreaterThanOrEqual(3000);
      expect(denali.isLand).toBe(true);

      const mariana = getEstimatedElevation(11.3733, 142.1989);
      expect(mariana.elevationMeters).toBeLessThanOrEqual(-8000);
      expect(mariana.terrainType).toBe('ocean');
      expect(mariana.isLand).toBe(false);

      const tonga = getEstimatedElevation(-23.2833, -174.75);
      expect(tonga.elevationMeters).toBeLessThanOrEqual(-8000);
      expect(tonga.isLand).toBe(false);

      const southPole = getEstimatedElevation(-90, 0);
      expect(southPole.isLand).toBe(true);
      expect(southPole.elevationMeters).toBeGreaterThanOrEqual(1500);
    });
  });
});
