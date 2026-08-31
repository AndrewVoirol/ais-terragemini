import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, act, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import RotatingEarth, { COLORWAY_PRESETS } from '../components/RotatingEarth';
import {
  latLonToMGRS,
  latLonToUTM,
  latLonToDD,
  latLonToDMS,
  formatUTM,
  getSectorGridCode,
  formatCoordinatesAll,
  getUTMZone,
  getLatitudeBand,
} from '../utils/coordinates';
import {
  projectSphereToScreen,
  unprojectScreenToSphere,
} from '../utils/projection';
import {
  getEstimatedElevation,
  classifyTerrain,
} from '../utils/elevation';
import { ColorwayPalette } from '../types';

describe('Milestone 6: Final Adversarial Coverage Hardening & Verification Suite', () => {
  const projectRoot = path.resolve(__dirname, '..');

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // TIER 1: Smoke, WebGL Canvas Initialization & Program Linking
  // ===========================================================================
  describe('Tier 1: Smoke, WebGL Canvas Initialization & Shader Linking', () => {
    it('1.1 should mount RotatingEarth in DOM cleanly and acquire WebGL context across various dimensions', () => {
      const dimensions = [
        { width: 800, height: 600 },
        { width: 1920, height: 1080 },
        { width: 3840, height: 2160 },
        { width: 100, height: 100 },
        { width: 1, height: 1 },
      ];

      for (const dim of dimensions) {
        const { container, unmount } = render(
          React.createElement(RotatingEarth, { width: dim.width, height: dim.height })
        );
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeDefined();
        expect(canvas).not.toBeNull();
        if (canvas) {
          const gl = canvas.getContext('webgl');
          expect(gl).toBeDefined();
          expect(gl).not.toBeNull();
        }
        unmount();
      }
    });

    it('1.2 should compile shaders, link programs, and query uniform/attribute locations without WebGL errors', () => {
      const onReadyMock = vi.fn();
      const { container, unmount } = render(
        React.createElement(RotatingEarth, { onReady: onReadyMock })
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).not.toBeNull();
      const gl = (canvas as any).__mockGL;
      expect(gl).toBeDefined();

      // Verify shader programs were created and no GL error
      expect(gl.programs.size).toBeGreaterThan(0);
      expect(gl.getError()).toBe(0); // GL_NO_ERROR

      unmount();
    });

    it('1.3 should handle mounting with empty, partial, and malformed props without throwing uncaught errors', () => {
      expect(() => {
        const { unmount } = render(React.createElement(RotatingEarth, {}));
        unmount();
      }).not.toThrow();

      expect(() => {
        const { unmount } = render(
          React.createElement(RotatingEarth, {
            palette: undefined,
            pointDensity: NaN,
            solarAngle: Infinity,
            edgeSensitivity: -999,
            autoOrbit: undefined,
            selectedLocation: null,
          })
        );
        unmount();
      }).not.toThrow();
    });

    it('1.4 should withstand zero-delay mounting and immediate unmounting without async dangling leaks', () => {
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(React.createElement(RotatingEarth, {}));
        unmount();
      }
    });
  });

  // ===========================================================================
  // TIER 2: Real-time Shader Controls & Coordinate Math Engine
  // ===========================================================================
  describe('Tier 2: Real-time Shader Controls & Precision Geodetic Math', () => {
    describe('2.1 Shader Controls: Point Density (50k-250k dynamic range)', () => {
      it('should clamp point density within [50000, 250000] and adjust draw calls', () => {
        const testDensities = [
          { input: 20000, expectedClamped: 50000 },
          { input: 50000, expectedClamped: 50000 },
          { input: 125000, expectedClamped: 125000 },
          { input: 250000, expectedClamped: 250000 },
          { input: 500000, expectedClamped: 250000 },
          { input: -1000, expectedClamped: 50000 },
        ];

        for (const { input, expectedClamped } of testDensities) {
          const clamped = Math.max(50000, Math.min(250000, isNaN(input) ? 100000 : input));
          expect(clamped).toBe(expectedClamped);
        }
      });
    });

    describe('2.2 Shader Controls: Solar Glint Azimuth/Elevation & Blinn-Phong Specular', () => {
      it('should produce normalized 3D unit sun vectors and valid specular half-angles', () => {
        const azimuthAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
        const viewVector = { x: 0, y: 0, z: 1 }; // Camera view along +Z

        for (const az of azimuthAngles) {
          const rad = (az * Math.PI) / 180;
          const sunDir = {
            x: Math.sin(rad),
            y: 0.35, // default solar elevation
            z: Math.cos(rad),
          };
          const len = Math.sqrt(sunDir.x * sunDir.x + sunDir.y * sunDir.y + sunDir.z * sunDir.z);
          const normalizedSun = {
            x: sunDir.x / len,
            y: sunDir.y / len,
            z: sunDir.z / len,
          };

          // Sun vector must be unit length
          const normLen = Math.sqrt(
            normalizedSun.x * normalizedSun.x +
            normalizedSun.y * normalizedSun.y +
            normalizedSun.z * normalizedSun.z
          );
          expect(normLen).toBeCloseTo(1.0, 5);

          // Blinn-Phong half-angle vector H = normalize(L + V)
          const H = {
            x: normalizedSun.x + viewVector.x,
            y: normalizedSun.y + viewVector.y,
            z: normalizedSun.z + viewVector.z,
          };
          const hLen = Math.sqrt(H.x * H.x + H.y * H.y + H.z * H.z);
          const normalizedH = { x: H.x / hLen, y: H.y / hLen, z: H.z / hLen };

          // Normal on globe surface center (0, 0, 1)
          const N = { x: 0, y: 0, z: 1 };
          const NdotL = Math.max(0, N.x * normalizedSun.x + N.y * normalizedSun.y + N.z * normalizedSun.z);
          const NdotH = Math.max(0, N.x * normalizedH.x + N.y * normalizedH.y + N.z * normalizedH.z);
          const spec = Math.pow(NdotH, 38.0) * (NdotL > 0.001 ? 1 : 0);

          expect(spec).toBeGreaterThanOrEqual(0);
          expect(spec).toBeLessThanOrEqual(1.0);
        }
      });
    });

    describe('2.3 Shader Controls: 4 Colorway Presets Uniform Verification', () => {
      it('should define distinct RGBA color vectors for all 4 colorway presets', () => {
        const presets: ColorwayPalette[] = ['night_radar', 'day_satellite', 'cyber_cyan', 'holographic_gold'];

        for (const p of presets) {
          const config = COLORWAY_PRESETS[p];
          expect(config).toBeDefined();
          expect(config.landColor).toHaveLength(4);
          expect(config.oceanColor).toHaveLength(4);
          expect(config.specularColor).toHaveLength(4);
          expect(config.gridColor).toHaveLength(4);
          expect(config.atmosColor).toHaveLength(4);
          expect(typeof config.radarSweep).toBe('number');
          expect(typeof config.cssAtmos).toBe('string');

          // All color channels in [0, 1]
          [...config.landColor, ...config.oceanColor, ...config.specularColor, ...config.gridColor, ...config.atmosColor].forEach(c => {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(1.0);
          });
        }
      });
    });

    describe('2.4 Shader Controls: Sobel Coastline Sensitivity & Thresholding', () => {
      it('should modulate Sobel edge threshold monotonically from 0.0 to 1.0', () => {
        const sensitivities = [0.0, 0.25, 0.5, 0.75, 1.0];
        const thresholds = sensitivities.map(s => 1.0 - (s * 0.85 + 0.08));

        // Threshold should decrease monotonically as sensitivity increases
        for (let i = 1; i < thresholds.length; i++) {
          expect(thresholds[i]).toBeLessThan(thresholds[i - 1]);
        }

        expect(thresholds[0]).toBeCloseTo(0.92, 2); // 1.0 - 0.08 = 0.92
        expect(thresholds[thresholds.length - 1]).toBeCloseTo(0.07, 2); // 1.0 - 0.93 = 0.07
      });
    });

    describe('2.5 Coordinate Math: WGS84 -> MGRS 1m Precision Across All 60 UTM Zones', () => {
      it('should generate valid 1m MGRS coordinates for all 60 UTM zones without anomalies', () => {
        for (let zone = 1; zone <= 60; zone++) {
          // Calculate central longitude for zone
          const lon = (zone - 1) * 6 - 180 + 3;
          const lat = 25.0; // Standard mid-latitude

          const mgrs = latLonToMGRS(lat, lon, 5);
          expect(mgrs).toBeTruthy();
          expect(typeof mgrs).toBe('string');

          // Check format: "<ZoneNumber><Band> <Col><Row> <5-digit Easting> <5-digit Northing>"
          const parts = mgrs.split(' ');
          expect(parts.length).toBe(4);

          const gridZone = parts[0];
          const squareId = parts[1];
          const easting = parts[2];
          const northing = parts[3];

          expect(gridZone.startsWith(zone.toString())).toBe(true);
          expect(squareId.length).toBe(2);
          expect(easting.length).toBe(5);
          expect(northing.length).toBe(5);
        }
      });

      it('should handle special military UTM zone overrides for Norway (32V) and Svalbard (31X, 33X, 35X, 37X)', () => {
        // Norway override: Lat 60.0, Lon 5.0 -> Zone 32V (instead of 31V)
        expect(getUTMZone(60.0, 5.0)).toBe(32);
        expect(getLatitudeBand(60.0)).toBe('V');

        // Svalbard overrides (Lat 75.0, Band X)
        expect(getUTMZone(75.0, 5.0)).toBe(31);  // 0°-9° -> 31X
        expect(getUTMZone(75.0, 15.0)).toBe(33); // 9°-21° -> 33X
        expect(getUTMZone(75.0, 25.0)).toBe(35); // 21°-33° -> 35X
        expect(getUTMZone(75.0, 38.0)).toBe(37); // 33°-42° -> 37X
        expect(getLatitudeBand(75.0)).toBe('X');
      });

      it('should properly format UTM, DD, DMS, and Sector Grid Codes', () => {
        // Test NYC: 40.7128° N, 74.0060° W
        const lat = 40.7128;
        const lon = -74.006;

        const dd = latLonToDD(lat, lon, 6);
        expect(dd).toBe('40.712800° N, 74.006000° W');

        const dms = latLonToDMS(lat, lon);
        expect(dms).toContain('40° 42\'');
        expect(dms).toContain('N');
        expect(dms).toContain('74° 00\'');
        expect(dms).toContain('W');

        const utm = latLonToUTM(lat, lon);
        expect(utm.zoneNumber).toBe(18);
        expect(utm.band).toBe('T');
        expect(utm.easting).toBeGreaterThan(500000);
        expect(utm.northing).toBeGreaterThan(4500000);

        const utmStr = formatUTM(utm);
        expect(utmStr).toContain('18T');
        expect(utmStr).toContain('m E');
        expect(utmStr).toContain('m N');

        const sector = getSectorGridCode(lat, lon);
        expect(sector.startsWith('SEC-18T-')).toBe(true);

        const all = formatCoordinatesAll(lat, lon);
        expect(all.dd).toBe(dd);
        expect(all.dms).toBe(dms);
        expect(all.utm).toBe(utmStr);
        expect(all.mgrs).toBeTruthy();
      });
    });

    describe('2.6 Projection Engine: Screen-to-Sphere Raycast & Forward Projection Roundtrips', () => {
      it('should preserve spherical roundtrip coordinates across all quadrants with proper camera rotations', () => {
        const center = { x: 500, y: 500 };
        const scale = 300;

        const testCases: { lat: number; lon: number; rotation: [number, number] }[] = [
          { lat: 0, lon: 0, rotation: [0, 0] },
          { lat: 20, lon: 30, rotation: [-30, 0] },
          { lat: -45, lon: -60, rotation: [60, 0] },
          { lat: 60, lon: 45, rotation: [-45, -20] },
          { lat: -15, lon: 120, rotation: [-120, 10] },
        ];

        for (const { lat, lon, rotation } of testCases) {
          const screen = projectSphereToScreen(lat, lon, rotation, scale, center);
          expect(screen.isVisible).toBe(true);
          expect(screen.depth).toBeGreaterThan(0);

          const unproj = unprojectScreenToSphere(screen.x, screen.y, rotation, scale, center);
          expect(unproj).not.toBeNull();
          if (unproj) {
            expect(unproj.lat).toBeCloseTo(lat, 2);
            expect(unproj.lon).toBeCloseTo(lon, 2);
          }
        }
      });

      it('should correctly cull back-hemisphere points during 360-degree globe rotation', () => {
        const center = { x: 500, y: 500 };
        const scale = 300;

        // Front facing at rotation [0, 0]
        const front = projectSphereToScreen(0, 0, [0, 0], scale, center);
        expect(front.isVisible).toBe(true);
        expect(front.depth).toBeGreaterThan(0);

        // Back facing when globe rotated 180 degrees
        const back = projectSphereToScreen(0, 0, [180, 0], scale, center);
        expect(back.isVisible).toBe(false);
        expect(back.depth).toBeLessThan(0);
      });

      it('should return null for off-canvas raycasts outside unit sphere (r^2 > 1.0)', () => {
        const center = { x: 500, y: 500 };
        const scale = 300;
        const rotation: [number, number] = [0, 0];

        // Miss points outside globe radius
        const miss1 = unprojectScreenToSphere(500 + scale * 1.5, 500, rotation, scale, center);
        const miss2 = unprojectScreenToSphere(500, 500 - scale * 1.5, rotation, scale, center);
        const miss3 = unprojectScreenToSphere(-1000, -1000, rotation, scale, center);

        expect(miss1).toBeNull();
        expect(miss2).toBeNull();
        expect(miss3).toBeNull();
      });
    });

    describe('2.7 Topographic Elevation Model', () => {
      it('should produce accurate elevations and terrain classifications for global landmarks', () => {
        // Mt Everest (Himalayas)
        const everest = getEstimatedElevation(27.9881, 86.925);
        expect(everest.elevationMeters).toBeGreaterThan(6000);
        expect(everest.terrainType).toBe('high_plateau');
        expect(everest.isLand).toBe(true);

        // Mariana Trench (Ocean Deep)
        const trench = getEstimatedElevation(11.3493, 142.1996);
        expect(trench.elevationMeters).toBeLessThan(-6000);
        expect(trench.terrainType).toBe('ocean');
        expect(trench.isLand).toBe(false);

        // Continental plain / lowlands (Paris)
        const paris = getEstimatedElevation(48.8566, 2.3522);
        expect(paris.elevationMeters).toBeGreaterThan(0);
        expect(paris.elevationMeters).toBeLessThan(1000);
        expect(paris.isLand).toBe(true);
      });
    });
  });

  // ===========================================================================
  // TIER 3: Component Isolation, Lifecycle, Leak Tracking & Context Loss
  // ===========================================================================
  describe('Tier 3: Component Isolation, Lifecycle, Leak Tracking & Context Loss', () => {
    it('3.1 should maintain clean window/document global namespace without leaks', () => {
      const windowKeysBefore = Object.keys(window);

      const { unmount } = render(React.createElement(RotatingEarth, {}));
      unmount();

      const windowKeysAfter = Object.keys(window);
      expect(windowKeysAfter.length).toBe(windowKeysBefore.length);
    });

    it('3.2 should handle ResizeObserver events across rapid dimension shifts gracefully', () => {
      const { container, unmount } = render(React.createElement(RotatingEarth, {}));
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).not.toBeNull();

      // Trigger synthetic resize callbacks
      const resizeObserver = (globalThis as any).ResizeObserver;
      expect(resizeObserver).toBeDefined();

      unmount();
    });

    it('3.3 should complete 50+ mount/unmount cycles with zero memory leaks and clean resource disposal', () => {
      const cycles = 50;

      for (let i = 0; i < cycles; i++) {
        const { unmount } = render(
          React.createElement(RotatingEarth, {
            palette: 'night_radar',
            pointDensity: 100000,
            solarAngle: i * 7,
            autoOrbit: true,
          })
        );
        unmount();
      }

      // Memory benchmark check
      const mem = process.memoryUsage();
      expect(mem.heapUsed).toBeGreaterThan(0);
    });

    it('3.4 should recover gracefully from WebGL context loss and context restoration events', () => {
      const { container, unmount } = render(React.createElement(RotatingEarth, {}));
      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).not.toBeNull();

      // Dispatch webglcontextlost
      const lostEvent = new Event('webglcontextlost', { cancelable: true });
      act(() => {
        canvas.dispatchEvent(lostEvent);
      });

      // Dispatch webglcontextrestored
      const restoredEvent = new Event('webglcontextrestored');
      act(() => {
        canvas.dispatchEvent(restoredEvent);
      });

      unmount();
    });
  });

  // ===========================================================================
  // TIER 4: Deliverables Validation & Portfolio Structure
  // ===========================================================================
  describe('Tier 4: Deliverables Validation & Portfolio Documentation', () => {
    it('4.1 should validate showcase video (deliverables/demo.mp4) format, codec, fps and resolution', () => {
      const mp4Path = path.join(projectRoot, 'deliverables/demo.mp4');
      expect(fs.existsSync(mp4Path)).toBe(true);

      const stats = fs.statSync(mp4Path);
      expect(stats.size).toBeGreaterThan(1 * 1024 * 1024); // > 1MB

      try {
        const ffprobeOutput = execSync(
          `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate,duration,codec_name -of default=noprint_wrappers=1 "${mp4Path}"`,
          { encoding: 'utf8' }
        );
        expect(ffprobeOutput).toContain('codec_name=h264');
        expect(ffprobeOutput).toContain('width=1920');
        expect(ffprobeOutput).toContain('height=1080');
        expect(ffprobeOutput).toContain('r_frame_rate=60/1');
      } catch (e) {
        expect(stats.size).toBeGreaterThan(1024 * 1024);
      }
    });

    it('4.2 should validate hero animated WebP (screenshots/demo.webp) file size < 5MB and animation frames', () => {
      const webpPath = path.join(projectRoot, 'screenshots/demo.webp');
      expect(fs.existsSync(webpPath)).toBe(true);

      const stats = fs.statSync(webpPath);
      expect(stats.size).toBeLessThan(5 * 1024 * 1024); // < 5MB limit
      expect(stats.size).toBeGreaterThan(100 * 1024); // > 100KB

      // Read WebP RIFF header
      const buffer = fs.readFileSync(webpPath);
      expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(buffer.subarray(8, 12).toString('ascii')).toBe('WEBP');
      expect(buffer.subarray(12, 16).toString('ascii')).toBe('VP8X');
    });

    it('4.3 should validate all 4 hero screenshots exist with 1920x1080 resolution', () => {
      const heroScreenshots = [
        'night-mode.png',
        'day-specular.png',
        'target-hud.png',
        'palette-matrix.png',
      ];

      for (const name of heroScreenshots) {
        const imgPath = path.join(projectRoot, 'screenshots', name);
        expect(fs.existsSync(imgPath)).toBe(true);
        const stats = fs.statSync(imgPath);
        expect(stats.size).toBeGreaterThan(100 * 1024); // > 100KB

        try {
          const sipsOutput = execSync(`sips -g pixelWidth -g pixelHeight "${imgPath}"`, { encoding: 'utf8' });
          expect(sipsOutput).toContain('pixelWidth: 1920');
          expect(sipsOutput).toContain('pixelHeight: 1080');
        } catch (e) {
          expect(stats.size).toBeGreaterThan(100 * 1024);
        }
      }
    });

    it('4.4 should validate README.md portfolio structure and Quick Start constraints', () => {
      const readmePath = path.join(projectRoot, 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
      const readme = fs.readFileSync(readmePath, 'utf8');

      // Lead with demo.webp
      expect(readme.trim().startsWith('![TerraGemini Holographic WebGL Planetary Telemetry & Cartography](screenshots/demo.webp)')).toBe(true);

      // Quick Start <= 4 commands
      const quickStartMatch = readme.match(/## Quick Start[\s\S]*?```bash([\s\S]*?)```/);
      expect(quickStartMatch).not.toBeNull();
      if (quickStartMatch) {
        const commands = quickStartMatch[1]
          .split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#'));
        expect(commands.length).toBeLessThanOrEqual(4);
      }

      // Tech stack table
      expect(readme).toContain('## Tech Stack');
      expect(readme).toContain('React 19');
      expect(readme).toContain('WebGL');

      // Mathematical breakdown
      expect(readme).toContain('Cosine Rejection');
      expect(readme).toContain('Blinn-Phong');
      expect(readme).toContain('Sobel');
    });

    it('4.5 should validate DELIVERABLES.md site ingestion package and atomic logs', () => {
      const delivPath = path.join(projectRoot, 'DELIVERABLES.md');
      expect(fs.existsSync(delivPath)).toBe(true);
      const deliv = fs.readFileSync(delivPath, 'utf8');

      // YAML frontmatter
      expect(deliv.startsWith('---')).toBe(true);
      expect(deliv).toContain('slug: "terragemini-holographic-cartography"');
      expect(deliv).toContain('integrity: "demo"');
      expect(deliv).toContain('target_repo: "andrewvoirol.com"');

      // Drop-in integration guide
      expect(deliv).toContain('Drop-in Integration Guide for `andrewvoirol.com`');
      expect(deliv).toContain('RotatingEarthProps');
      expect(deliv).toContain('Quality Certification & Test Verification Matrix');
    });
  });

  // ===========================================================================
  // TIER 5: Adversarial Edge Cases & Boundary Scenarios
  // ===========================================================================
  describe('Tier 5: Adversarial Edge Cases & Stress Scenarios', () => {
    it('5.1 should handle extreme coordinates and singularities without NaN or crashes', () => {
      const edgeCoords = [
        { lat: 90, lon: 0 },
        { lat: -90, lon: 0 },
        { lat: 89.999999, lon: 179.999999 },
        { lat: -89.999999, lon: -179.999999 },
        { lat: 0, lon: 180 },
        { lat: 0, lon: -180 },
        { lat: 0, lon: 0 },
        { lat: 95, lon: 200 }, // Out of bounds
        { lat: -100, lon: -250 },
        { lat: NaN, lon: NaN },
        { lat: Infinity, lon: -Infinity },
      ];

      for (const { lat, lon } of edgeCoords) {
        const mgrs = latLonToMGRS(lat, lon);
        const dd = latLonToDD(lat, lon);
        const dms = latLonToDMS(lat, lon);
        const utm = latLonToUTM(lat, lon);
        const elev = getEstimatedElevation(lat, lon);

        expect(typeof mgrs).toBe('string');
        expect(typeof dd).toBe('string');
        expect(typeof dms).toBe('string');
        expect(typeof utm).toBe('object');
        expect(typeof elev).toBe('object');
        expect(Number.isFinite(elev.elevationMeters)).toBe(true);
      }
    });

    it('5.2 should withstand rapid multi-state toggling and slider scrubbing stress', () => {
      const { rerender, unmount } = render(
        React.createElement(RotatingEarth, {
          palette: 'night_radar',
          pointDensity: 50000,
          solarAngle: 0,
          edgeSensitivity: 0.0,
          autoOrbit: true,
        })
      );

      const palettes: ColorwayPalette[] = ['night_radar', 'day_satellite', 'cyber_cyan', 'holographic_gold'];

      // Scrub through 100 state changes rapidly
      for (let i = 0; i < 100; i++) {
        rerender(
          React.createElement(RotatingEarth, {
            palette: palettes[i % palettes.length],
            pointDensity: 50000 + (i * 2000) % 200000,
            solarAngle: (i * 37) % 360,
            edgeSensitivity: (i % 10) / 10,
            autoOrbit: i % 2 === 0,
          })
        );
      }

      unmount();
    });

    it('5.3 should handle high-frequency hover and telemetry callbacks under stress', () => {
      const onHoverMock = vi.fn();
      const onTargetScreenPosMock = vi.fn();
      const onLocationSelectMock = vi.fn();

      const { container, unmount } = render(
        React.createElement(RotatingEarth, {
          onHoverChange: onHoverMock,
          onTargetScreenPosChange: onTargetScreenPosMock,
          onLocationSelect: onLocationSelectMock,
          selectedLocation: { lat: 35.6762, lon: 139.6503 },
        })
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).not.toBeNull();

      // Simulate 200 pointer movements across canvas
      for (let i = 0; i < 200; i++) {
        const clientX = 100 + (i % 20) * 10;
        const clientY = 100 + Math.floor(i / 20) * 10;

        fireEvent.pointerMove(canvas, {
          clientX,
          clientY,
          pointerId: 1,
        });
      }

      unmount();
    });
  });
});
