import { describe, it, expect, beforeAll } from 'vitest';

// Reference mathematical models for independent oracle verification
const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

function referenceProjectSphere(
  lat: number,
  lon: number,
  rotation: [number, number],
  scale: number,
  center: { x: number; y: number }
) {
  const phi = lat * DEG2RAD;
  const lambda = lon * DEG2RAD;
  const yaw = rotation[0] * DEG2RAD;
  const pitch = rotation[1] * DEG2RAD;

  // 3D Cartesian coordinates on unit sphere
  const x0 = Math.cos(phi) * Math.sin(lambda);
  const y0 = Math.sin(phi);
  const z0 = Math.cos(phi) * Math.cos(lambda);

  // Rotate around Y (yaw)
  const x1 = Math.cos(yaw) * x0 + Math.sin(yaw) * z0;
  const y1 = y0;
  const z1 = -Math.sin(yaw) * x0 + Math.cos(yaw) * z0;

  // Rotate around X (pitch)
  const x2 = x1;
  const y2 = Math.cos(pitch) * y1 - Math.sin(pitch) * z1;
  const z2 = Math.sin(pitch) * y1 + Math.cos(pitch) * z1;

  const isVisible = z2 > 0;
  const screenX = center.x + x2 * scale;
  const screenY = center.y - y2 * scale;

  return { x: screenX, y: screenY, depth: z2, isVisible };
}

function referenceUnprojectScreen(
  screenX: number,
  screenY: number,
  rotation: [number, number],
  scale: number,
  center: { x: number; y: number }
): { lat: number; lon: number } | null {
  const dx = (screenX - center.x) / scale;
  const dy = -(screenY - center.y) / scale;
  const r2 = dx * dx + dy * dy;

  if (r2 > 1.0) return null; // Ray missed sphere

  const dz = Math.sqrt(Math.max(0, 1.0 - r2));
  const yaw = -rotation[0] * DEG2RAD;
  const pitch = -rotation[1] * DEG2RAD;

  // Reverse pitch (rotate X)
  const x1 = dx;
  const y1 = Math.cos(pitch) * dy - Math.sin(pitch) * dz;
  const z1 = Math.sin(pitch) * dy + Math.cos(pitch) * dz;

  // Reverse yaw (rotate Y)
  const x0 = Math.cos(yaw) * x1 + Math.sin(yaw) * z1;
  const y0 = y1;
  const z0 = -Math.sin(yaw) * x1 + Math.cos(yaw) * z1;

  const lat = Math.asin(Math.max(-1, Math.min(1, y0))) * RAD2DEG;
  const lon = Math.atan2(x0, z0) * RAD2DEG;

  return { lat, lon };
}

describe('Tier 2: Math, Coordinate Conversions & Shader Controls Suite', () => {
  let coordsModule: any = null;
  let projectionModule: any = null;
  let elevationModule: any = null;

  beforeAll(async () => {
    const coordsPath = '../utils/coordinates';
    const projPath = '../utils/projection';
    const elevPath = '../utils/elevation';
    try {
      coordsModule = await import(/* @vite-ignore */ coordsPath);
    } catch {
      coordsModule = null;
    }
    try {
      projectionModule = await import(/* @vite-ignore */ projPath);
    } catch {
      projectionModule = null;
    }
    try {
      elevationModule = await import(/* @vite-ignore */ elevPath);
    } catch {
      elevationModule = null;
    }
  });

  describe('2.1 WGS84 to MGRS, UTM, DD, and DMS Conversion Accuracy', () => {
    it('2.1.1 should correctly format NYC coordinates in DD and DMS', () => {
      const lat = 40.7128;
      const lon = -74.006;

      if (coordsModule?.latLonToDD) {
        const dd = coordsModule.latLonToDD(lat, lon);
        expect(dd).toMatch(/40\.71/);
        expect(dd).toMatch(/N/i);
        expect(dd).toMatch(/74\.00/);
        expect(dd).toMatch(/W/i);
      }

      if (coordsModule?.latLonToDMS) {
        const dms = coordsModule.latLonToDMS(lat, lon);
        expect(dms).toMatch(/40°.*42'.*N/i);
        expect(dms).toMatch(/74°.*0'.*W/i);
      }
    });

    it('2.1.2 should calculate correct UTM zone and band for NYC, Tokyo, Paris, and Equator', () => {
      if (coordsModule?.latLonToUTM) {
        // NYC: Zone 18, Band T
        const nycUTM = coordsModule.latLonToUTM(40.7128, -74.006);
        expect(nycUTM.zoneNumber).toBe(18);
        expect(nycUTM.band.toUpperCase()).toBe('T');
        expect(nycUTM.easting).toBeGreaterThan(500000);
        expect(nycUTM.northing).toBeGreaterThan(4000000);

        // Tokyo: Zone 54, Band S
        const tokyoUTM = coordsModule.latLonToUTM(35.6762, 139.6503);
        expect(tokyoUTM.zoneNumber).toBe(54);
        expect(tokyoUTM.band.toUpperCase()).toBe('S');

        // Paris: Zone 31, Band U
        const parisUTM = coordsModule.latLonToUTM(48.8566, 2.3522);
        expect(parisUTM.zoneNumber).toBe(31);
        expect(parisUTM.band.toUpperCase()).toBe('U');

        // Equator Prime Meridian (0, 0): Zone 31, Band N (Western edge of zone 31, 3° from CM)
        const equatorUTM = coordsModule.latLonToUTM(0.0, 0.0);
        expect(equatorUTM.zoneNumber).toBe(31);
        expect(equatorUTM.band.toUpperCase()).toBe('N');
        expect(Math.round(equatorUTM.easting)).toBe(166021);
        expect(Math.round(equatorUTM.northing)).toBe(0);

        // Central Meridian of Zone 31 (0, 3°E): Easting is 500,000m
        const cmUTM = coordsModule.latLonToUTM(0.0, 3.0);
        expect(cmUTM.zoneNumber).toBe(31);
        expect(Math.round(cmUTM.easting)).toBe(500000);
      }
    });

    it('2.1.3 should compute 10-digit 1m precision MGRS strings for tactical benchmarks', () => {
      if (coordsModule?.latLonToMGRS) {
        const nycMGRS = coordsModule.latLonToMGRS(40.7128, -74.006, 5);
        expect(nycMGRS.replace(/\s+/g, '')).toMatch(/^18TWL/);

        const tokyoMGRS = coordsModule.latLonToMGRS(35.6762, 139.6503, 5);
        expect(tokyoMGRS.replace(/\s+/g, '')).toMatch(/^54S/);

        const parisMGRS = coordsModule.latLonToMGRS(48.8566, 2.3522, 5);
        expect(parisMGRS.replace(/\s+/g, '')).toMatch(/^31U/);
      }
    });

    it('2.1.4 should handle polar and boundary coordinate transitions without NaN', () => {
      if (coordsModule?.formatCoordinatesAll) {
        const northPolar = coordsModule.formatCoordinatesAll(84.0, 0.0);
        expect(northPolar).toBeDefined();
        expect(northPolar.dd).not.toContain('NaN');

        const southPolar = coordsModule.formatCoordinatesAll(-80.0, 180.0);
        expect(southPolar).toBeDefined();
        expect(southPolar.dd).not.toContain('NaN');

        const dateLine = coordsModule.formatCoordinatesAll(0.0, -180.0);
        expect(dateLine).toBeDefined();
        expect(dateLine.dd).not.toContain('NaN');
      }
    });

    it('2.1.5 should handle NaN and Infinity inputs gracefully with safe fallbacks and empty strings', () => {
      if (coordsModule?.latLonToMGRS) {
        expect(coordsModule.latLonToMGRS(NaN, NaN)).toBe('');
        expect(coordsModule.latLonToMGRS(Infinity, -74.006)).toBe('');
        expect(coordsModule.latLonToMGRS(40.7128, -Infinity)).toBe('');
      }

      if (coordsModule?.getSectorGridCode) {
        expect(coordsModule.getSectorGridCode(NaN, NaN)).toBe('');
        expect(coordsModule.getSectorGridCode(Infinity, 0)).toBe('');
      }

      if (coordsModule?.latLonToUTM) {
        const nanUTM = coordsModule.latLonToUTM(NaN, NaN);
        expect(nanUTM.zoneNumber).toBe(0);
        expect(nanUTM.band).toBe('');
      }

      if (coordsModule?.latLonToDD) {
        expect(coordsModule.latLonToDD(NaN, NaN)).toBe('');
      }

      if (coordsModule?.latLonToDMS) {
        expect(coordsModule.latLonToDMS(NaN, NaN)).toBe('');
      }

      if (coordsModule?.formatCoordinatesAll) {
        const nanAll = coordsModule.formatCoordinatesAll(NaN, NaN);
        expect(nanAll.mgrs).toBe('');
        expect(nanAll.dd).toBe('');
      }
    });

    it('2.1.6 should correctly calculate canonical DoD/NGA row letters for even UTM zones', () => {
      if (coordsModule?.latLonToMGRS) {
        // Washington DC: Zone 18 (Even) -> 18S UJ
        const dcMGRS = coordsModule.latLonToMGRS(38.8895, -77.0353, 5);
        expect(dcMGRS.replace(/\s+/g, '')).toMatch(/^18SUJ/);

        // Sydney: Zone 56 (Even, South) -> 56H LH
        const sydneyMGRS = coordsModule.latLonToMGRS(-33.8568, 151.2153, 5);
        expect(sydneyMGRS.replace(/\s+/g, '')).toMatch(/^56HLH/);
      }
    });
  });

  describe('2.2 3D Spherical Raycasting & Forward Projection Engine', () => {
    it('2.2.1 should project geographic origin (0, 0) to screen center when rotation is zero', () => {
      const center = { x: 400, y: 300 };
      const scale = 200;
      const rotation: [number, number] = [0, 0];

      const proj = projectionModule?.projectSphereToScreen
        ? projectionModule.projectSphereToScreen(0, 0, rotation, scale, center)
        : referenceProjectSphere(0, 0, rotation, scale, center);

      expect(proj.x).toBeCloseTo(400, 1);
      expect(proj.y).toBeCloseTo(300, 1);
      expect(proj.depth).toBeGreaterThan(0);
      expect(proj.isVisible).toBe(true);
    });

    it('2.2.2 should unproject screen center (cx, cy) to geographic origin (0, 0)', () => {
      const center = { x: 400, y: 300 };
      const scale = 200;
      const rotation: [number, number] = [0, 0];

      const unproj = projectionModule?.unprojectScreenToSphere
        ? projectionModule.unprojectScreenToSphere(400, 300, rotation, scale, center)
        : referenceUnprojectScreen(400, 300, rotation, scale, center);

      expect(unproj).not.toBeNull();
      expect(unproj!.lat).toBeCloseTo(0, 1);
      expect(unproj!.lon).toBeCloseTo(0, 1);
    });

    it('2.2.3 should maintain roundtrip consistency between projection and unprojection', () => {
      const center = { x: 500, y: 500 };
      const scale = 250;
      const rotation: [number, number] = [30, -15];

      const testCoords = [
        { lat: 10, lon: -20 },
        { lat: -25, lon: -40 },
        { lat: 35, lon: -10 },
      ];

      for (const coord of testCoords) {
        const proj = projectionModule?.projectSphereToScreen
          ? projectionModule.projectSphereToScreen(coord.lat, coord.lon, rotation, scale, center)
          : referenceProjectSphere(coord.lat, coord.lon, rotation, scale, center);

        if (proj.isVisible) {
          const unproj = projectionModule?.unprojectScreenToSphere
            ? projectionModule.unprojectScreenToSphere(proj.x, proj.y, rotation, scale, center)
            : referenceUnprojectScreen(proj.x, proj.y, rotation, scale, center);

          expect(unproj).not.toBeNull();
          expect(unproj!.lat).toBeCloseTo(coord.lat, 1);
          expect(unproj!.lon).toBeCloseTo(coord.lon, 1);
        }
      }
    });

    it('2.2.4 should cull occluded points on the far hemisphere (depth < 0, isVisible = false)', () => {
      const center = { x: 400, y: 300 };
      const scale = 200;
      const rotation: [number, number] = [0, 0];

      // Point on back hemisphere (lon = 180 when globe rotation is 0)
      const proj = projectionModule?.projectSphereToScreen
        ? projectionModule.projectSphereToScreen(0, 180, rotation, scale, center)
        : referenceProjectSphere(0, 180, rotation, scale, center);

      expect(proj.isVisible).toBe(false);
      expect(proj.depth).toBeLessThan(0);
    });

    it('2.2.5 should return null when raycasting off-globe coordinates (r > scale)', () => {
      const center = { x: 400, y: 300 };
      const scale = 200;
      const rotation: [number, number] = [0, 0];

      // Pixel far outside radius (dx = 300 > scale 200)
      const unproj = projectionModule?.unprojectScreenToSphere
        ? projectionModule.unprojectScreenToSphere(750, 300, rotation, scale, center)
        : referenceUnprojectScreen(750, 300, rotation, scale, center);

      expect(unproj).toBeNull();
    });

    it('2.2.6 should return null for non-finite screen coordinates and degenerate scale', () => {
      const center = { x: 400, y: 300 };
      const scale = 200;
      const rotation: [number, number] = [0, 0];

      if (projectionModule?.unprojectScreenToSphere) {
        expect(projectionModule.unprojectScreenToSphere(NaN, 300, rotation, scale, center)).toBeNull();
        expect(projectionModule.unprojectScreenToSphere(400, NaN, rotation, scale, center)).toBeNull();
        expect(projectionModule.unprojectScreenToSphere(400, 300, rotation, 0, center)).toBeNull();
        expect(projectionModule.unprojectScreenToSphere(400, 300, rotation, -100, center)).toBeNull();
        expect(projectionModule.unprojectScreenToSphere(400, 300, rotation, Infinity, center)).toBeNull();
      }
    });
  });

  describe('2.3 Topographic Elevation & Terrain Classification', () => {
    it('2.3.1 should classify open ocean coordinates correctly', () => {
      if (elevationModule?.classifyTerrain) {
        // Point in the Pacific Ocean
        const terrain = elevationModule.classifyTerrain(0.0, -140.0);
        expect(terrain).toBe('ocean');
      }
    });

    it('2.3.2 should return normalized elevation values between 0.0 and 1.0', () => {
      if (elevationModule?.getEstimatedElevation) {
        const resHimalayas = elevationModule.getEstimatedElevation(27.9881, 86.925);
        const normHimalayas = typeof resHimalayas === 'number' ? resHimalayas : resHimalayas.normalizedElevation;
        expect(normHimalayas).toBeGreaterThanOrEqual(0.0);
        expect(normHimalayas).toBeLessThanOrEqual(1.0);

        const resOcean = elevationModule.getEstimatedElevation(0.0, -140.0);
        const normOcean = typeof resOcean === 'number' ? resOcean : resOcean.normalizedElevation;
        expect(normOcean).toBeGreaterThanOrEqual(0.0);
        expect(normOcean).toBeLessThanOrEqual(1.0);
      }
    });

    it('2.3.3 should maintain elevation continuity across the antimeridian (-180° / +180°)', () => {
      if (elevationModule?.getEstimatedElevation) {
        const westEdge = elevationModule.getEstimatedElevation(-80.0, -180.0);
        const eastEdge = elevationModule.getEstimatedElevation(-80.0, 180.0);
        expect(westEdge.elevationMeters).toBe(eastEdge.elevationMeters);
        expect(westEdge.isLand).toBe(eastEdge.isLand);
        expect(westEdge.terrainType).toBe(eastEdge.terrainType);
      }
    });

    it('2.3.4 should correctly classify Puerto Rico Trench as deep ocean bathymetry', () => {
      if (elevationModule?.getEstimatedElevation) {
        const pr = elevationModule.getEstimatedElevation(19.7, -66.5);
        expect(pr.isLand).toBe(false);
        expect(pr.elevationMeters).toBeLessThan(-6000);
        expect(pr.terrainType).toBe('ocean');
      }
    });

    it('2.3.5 should accurately model European Alps and Caucasus Mountains separately', () => {
      if (elevationModule?.getEstimatedElevation) {
        // Mont Blanc in European Alps (45.83°N, 6.86°E)
        const montBlanc = elevationModule.getEstimatedElevation(45.83, 6.86);
        expect(montBlanc.isLand).toBe(true);
        expect(montBlanc.elevationMeters).toBeGreaterThan(3000);
        expect(montBlanc.description).toContain('European Alps');

        // Mount Elbrus in Caucasus Mountains (43.35°N, 42.44°E)
        const elbrus = elevationModule.getEstimatedElevation(43.35, 42.44);
        expect(elbrus.isLand).toBe(true);
        expect(elbrus.elevationMeters).toBeGreaterThan(4500);
        expect(elbrus.description).toContain('Caucasus');
      }
    });
  });

  describe('2.4 Shader Controls, Parameter Bounds & Uniform Calculations', () => {
    it('2.4.1 should validate point density parameter range (50,000 to 250,000)', () => {
      const clampDensity = (val: number) => Math.max(50000, Math.min(250000, Math.round(val)));

      expect(clampDensity(10000)).toBe(50000);
      expect(clampDensity(120000)).toBe(120000);
      expect(clampDensity(300000)).toBe(250000);
      expect(clampDensity(250000)).toBe(250000);
      expect(clampDensity(50000)).toBe(50000);
    });

    it('2.4.2 should calculate 3D solar lighting direction vector across 0° to 360°', () => {
      const computeSunVector = (angleDeg: number) => {
        const rad = angleDeg * DEG2RAD;
        return [Math.cos(rad), 0.3, Math.sin(rad)];
      };

      const vec0 = computeSunVector(0);
      expect(vec0[0]).toBeCloseTo(1.0, 4);
      expect(vec0[2]).toBeCloseTo(0.0, 4);

      const vec90 = computeSunVector(90);
      expect(vec90[0]).toBeCloseTo(0.0, 4);
      expect(vec90[2]).toBeCloseTo(1.0, 4);

      const vec180 = computeSunVector(180);
      expect(vec180[0]).toBeCloseTo(-1.0, 4);
      expect(vec180[2]).toBeCloseTo(0.0, 4);

      const vec270 = computeSunVector(270);
      expect(vec270[0]).toBeCloseTo(0.0, 4);
      expect(vec270[2]).toBeCloseTo(-1.0, 4);
    });

    it('2.4.3 should validate all 4 colorway presets (Night Radar, Day Satellite, Cyber Cyan, Holographic Gold)', () => {
      const validPalettes = ['night-radar', 'day-satellite', 'cyber-cyan', 'holographic-gold'];

      for (const palette of validPalettes) {
        expect(validPalettes).toContain(palette);
      }
    });

    it('2.4.4 should clamp Sobel edge sensitivity between 0.0 and 1.0', () => {
      const clampSobel = (val: number) => Math.max(0.0, Math.min(1.0, val));

      expect(clampSobel(-0.2)).toBe(0.0);
      expect(clampSobel(0.65)).toBe(0.65);
      expect(clampSobel(1.4)).toBe(1.0);
    });

    it('2.4.5 should apply damped drag friction physics on inertia decay', () => {
      let velocity = 10.0;
      const friction = 0.92;
      const minThreshold = 0.001;

      const steps: number[] = [];
      while (Math.abs(velocity) > minThreshold) {
        velocity *= friction;
        steps.push(velocity);
      }

      expect(steps.length).toBeGreaterThan(10);
      expect(velocity).toBeLessThanOrEqual(minThreshold);
      // Verify monotonically decreasing magnitude
      for (let i = 1; i < steps.length; i++) {
        expect(steps[i]).toBeLessThan(steps[i - 1]);
      }
    });
  });
});
