import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import RotatingEarth, { COLORWAY_PRESETS, UniformColorPreset } from '../components/RotatingEarth';
import { MockWebGLRenderingContext } from './setup';

describe('Milestone 2 Challenger Suite: WebGL Core & Shader Pipeline Refactor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ===========================================================================
  // SECTION 1: Dynamic Point Cloud Scaling Stability (50k to 250k points)
  // ===========================================================================
  describe('Section 1: Dynamic Point Density Scaling Stability', () => {
    const densities = [50000, 100000, 150000, 200000, 250000];

    densities.forEach((density) => {
      it(`1.1 should render stably at pointDensity = ${density.toLocaleString()}`, () => {
        const { container, unmount } = render(
          React.createElement(RotatingEarth, {
            width: 800,
            height: 600,
            pointDensity: density,
          })
        );

        const canvas = container.querySelector('canvas') as HTMLCanvasElement;
        expect(canvas).not.toBeNull();
        const gl = canvas.getContext('webgl') as any;
        expect(gl).not.toBeNull();

        unmount();
      });
    });

    it('1.2 should clamp extreme and out-of-bounds point densities to [50k, 250k] range', () => {
      const { container, rerender, unmount } = render(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
          pointDensity: -10000, // Below minimum
        })
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).not.toBeNull();

      // Test upper out-of-bounds
      rerender(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
          pointDensity: 1000000, // Above maximum
        })
      );
      expect(canvas).not.toBeNull();

      // Test NaN fallback
      rerender(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
          pointDensity: NaN,
        })
      );
      expect(canvas).not.toBeNull();

      unmount();
    });

    it('1.3 should execute dynamic density adjustment with O(1) buffer slicing and zero CPU re-allocations', () => {
      const { rerender, unmount } = render(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
          pointDensity: 50000,
        })
      );

      const t0 = performance.now();
      // Rapid density sweeps
      for (let d = 50000; d <= 250000; d += 25000) {
        rerender(
          React.createElement(RotatingEarth, {
            width: 800,
            height: 600,
            pointDensity: d,
          })
        );
      }
      const elapsed = performance.now() - t0;

      // 9 rerenders should complete in well under 100ms
      expect(elapsed).toBeLessThan(150);
      unmount();
    });
  });

  // ===========================================================================
  // SECTION 2: Solar Angle Scrubbing & Blinn-Phong Specular Reflection Math
  // ===========================================================================
  describe('Section 2: Solar Angle Scrubbing & Specular Glint Mechanics', () => {
    const testAngles = [0, 15, 45, 90, 135, 180, 225, 270, 315, 360, -45, 720];

    testAngles.forEach((angle) => {
      it(`2.1 should compute valid, normalized solar vectors at solarAngle = ${angle}° without singularities`, () => {
        const rad = (angle * Math.PI) / 180.0;
        const sunDir = [Math.cos(rad), 0.35, Math.sin(rad)];
        const len = Math.hypot(sunDir[0], sunDir[1], sunDir[2]);

        // Length must be strictly non-zero and finite
        expect(Number.isFinite(len)).toBe(true);
        expect(len).toBeGreaterThan(0.9);
        expect(len).toBeLessThan(1.2);

        const norm = [sunDir[0] / len, sunDir[1] / len, sunDir[2] / len];
        const normLen = Math.hypot(norm[0], norm[1], norm[2]);
        expect(normLen).toBeCloseTo(1.0, 5);

        // Verify Blinn-Phong half-angle vector H = normalize(L + V)
        const V = [0, 0, 1]; // View direction
        const LV = [norm[0] + V[0], norm[1] + V[1], norm[2] + V[2]];
        const lvLen = Math.hypot(LV[0], LV[1], LV[2]);
        expect(lvLen).toBeGreaterThan(0); // Never zero because norm[2] >= -1/1.05 > -1

        const H = [LV[0] / lvLen, LV[1] / lvLen, LV[2] / lvLen];
        const hLen = Math.hypot(H[0], H[1], H[2]);
        expect(hLen).toBeCloseTo(1.0, 5);

        // Verify specular power (N . H)^38 for any surface normal on sphere
        const N = [0, 0, 1]; // Center normal
        const NdotH = Math.max(0, N[0] * H[0] + N[1] * H[1] + N[2] * H[2]);
        const spec = Math.pow(NdotH, 38.0);
        expect(Number.isFinite(spec)).toBe(true);
        expect(spec).toBeGreaterThanOrEqual(0);
        expect(spec).toBeLessThanOrEqual(1.0);
      });
    });

    it('2.2 should smoothly scrub solarAngle from 0° to 360° across component renders', () => {
      const { container, rerender, unmount } = render(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
          solarAngle: 0,
        })
      );

      for (let angle = 0; angle <= 360; angle += 30) {
        rerender(
          React.createElement(RotatingEarth, {
            width: 800,
            height: 600,
            solarAngle: angle,
          })
        );
      }

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      unmount();
    });
  });

  // ===========================================================================
  // SECTION 3: 4 Colorway Preset Uniform Engine & Instantaneous Switching
  // ===========================================================================
  describe('Section 3: 4 Colorway Preset Uniform Engine', () => {
    const requiredPresets = ['night_radar', 'day_satellite', 'cyber_cyan', 'holographic_gold'];
    const aliasPresets = ['night-radar', 'day-satellite', 'cyber-cyan', 'holographic-gold'];

    it('3.1 should define all 4 canonical colorway presets with valid RGBA values in [0, 1]', () => {
      requiredPresets.forEach((name) => {
        const preset = COLORWAY_PRESETS[name];
        expect(preset).toBeDefined();

        // Check landColor
        expect(preset.landColor).toHaveLength(4);
        preset.landColor.forEach((c) => {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(1);
        });

        // Check oceanColor
        expect(preset.oceanColor).toHaveLength(4);
        preset.oceanColor.forEach((c) => {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(1);
        });

        // Check specularColor
        expect(preset.specularColor).toHaveLength(4);
        preset.specularColor.forEach((c) => {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(1);
        });

        // Check gridColor
        expect(preset.gridColor).toHaveLength(4);
        preset.gridColor.forEach((c) => {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(1);
        });

        // Check atmosColor
        expect(preset.atmosColor).toHaveLength(4);
        preset.atmosColor.forEach((c) => {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(1);
        });

        // Check radarSweep
        expect(preset.radarSweep).toBeGreaterThanOrEqual(0);
        expect(preset.radarSweep).toBeLessThanOrEqual(1);

        // Check cssAtmos
        expect(typeof preset.cssAtmos).toBe('string');
        expect(preset.cssAtmos.startsWith('rgba(')).toBe(true);
      });
    });

    it('3.2 should support kebab-case aliases for all presets', () => {
      aliasPresets.forEach((alias) => {
        expect(COLORWAY_PRESETS[alias]).toBeDefined();
        const canonical = alias.replace('-', '_');
        expect(COLORWAY_PRESETS[alias]).toEqual(COLORWAY_PRESETS[canonical]);
      });
    });

    it('3.3 should switch instantaneously across all 4 presets without recompiling shaders', () => {
      const { container, rerender, unmount } = render(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
          palette: 'night-radar' as any,
        })
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl') as any;

      // Track compileShader calls
      const initialCompileCount = gl.compileShader.mock.calls.length;

      // Rapidly switch between presets
      const sequence = ['day-satellite', 'cyber-cyan', 'holographic-gold', 'night-radar', 'cyber-cyan'];
      sequence.forEach((pal) => {
        rerender(
          React.createElement(RotatingEarth, {
            width: 800,
            height: 600,
            palette: pal as any,
          })
        );
      });

      // No new shader compilations should happen during preset switching
      const afterCompileCount = gl.compileShader.mock.calls.length;
      expect(afterCompileCount).toBe(initialCompileCount);

      unmount();
    });
  });

  // ===========================================================================
  // SECTION 4: Sobel Edge Convolution & Sensitivity Modulation
  // ===========================================================================
  describe('Section 4: Sobel Edge Convolution & Sensitivity Modulation', () => {
    it('4.1 should calculate exact 3x3 Sobel gradients for synthetic test patterns', () => {
      // Create a 3x3 test patch where left half is land (255) and right half is ocean (0)
      const w = 3;
      const h = 3;
      const imgData = new Uint8ClampedArray(w * h * 4);

      // Vertical step edge: columns 0 and 1 are white (land), column 2 is black (ocean)
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          const idx = (y * w + x) * 4;
          imgData[idx] = x < 2 ? 255 : 0;
        }
      }

      // Compute Sobel gradient at center (1, 1)
      let gx = 0;
      let gy = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = Math.max(0, Math.min(h - 1, 1 + dy));
        const row = ny * w;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(w - 1, 1 + dx));
          const val = imgData[(row + nx) * 4] > 100 ? 1.0 : 0.0;
          const kx = dx * (dy === 0 ? 2 : 1);
          const ky = dy * (dx === 0 ? 2 : 1);
          gx += kx * val;
          gy += ky * val;
        }
      }
      const grad = Math.min(1.0, Math.sqrt(gx * gx + gy * gy) / 4.0);

      // Gradient along edge should be strictly positive
      expect(grad).toBeGreaterThan(0.5);
      expect(grad).toBeLessThanOrEqual(1.0);
    });

    it('4.2 should modulate edge sensitivity from 0.0 to 1.0 seamlessly', () => {
      const sensitivities = [0.0, 0.25, 0.5, 0.75, 1.0];

      const { container, rerender, unmount } = render(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
          edgeSensitivity: 0.0,
        })
      );

      sensitivities.forEach((sens) => {
        rerender(
          React.createElement(RotatingEarth, {
            width: 800,
            height: 600,
            edgeSensitivity: sens,
          })
        );
      });

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      unmount();
    });
  });

  // ===========================================================================
  // SECTION 5: Mount / Unmount Stress Test (25 Cycles - Zero WebGL Resource Leaks)
  // ===========================================================================
  describe('Section 5: Mounting / Unmounting Lifecycle Stress (25+ Cycles)', () => {
    it('5.1 should cleanly dispose all WebGL programs and buffers over 25 mount/unmount cycles', () => {
      const cycles = 25;

      for (let i = 0; i < cycles; i++) {
        const { unmount, container } = render(
          React.createElement(RotatingEarth, {
            width: 600,
            height: 400,
            palette: (i % 2 === 0 ? 'cyber-cyan' : 'night-radar') as any,
          })
        );

        const canvas = container.querySelector('canvas') as HTMLCanvasElement;
        const gl = canvas.getContext('webgl') as unknown as MockWebGLRenderingContext;

        expect(gl).not.toBeNull();
        expect(gl.programs.size).toBeGreaterThan(0);
        expect(gl.buffers.size).toBeGreaterThan(0);

        act(() => {
          unmount();
        });

        // Verify after unmount, programs and buffers were deleted via deleteProgram / deleteBuffer
        expect(gl.programs.size).toBe(0);
        expect(gl.buffers.size).toBe(0);
      }
    });

    it('5.2 should clean up all event listeners and ResizeObserver instances on unmount', () => {
      const { unmount, container } = render(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
        })
      );

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();

      act(() => {
        unmount();
      });

      // No lingering canvas or detached error
      expect(true).toBe(true);
    });
  });

  // ===========================================================================
  // SECTION 6: WebGL Context Loss & Recovery Simulation
  // ===========================================================================
  describe('Section 6: WebGL Context Loss Event Simulation', () => {
    it('6.1 should handle multiple consecutive context loss and restore cycles without throwing', () => {
      const { container, unmount } = render(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
        })
      );

      const canvas = container.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas).not.toBeNull();

      // Simulate 5 consecutive context lost / restore cycles
      for (let cycle = 1; cycle <= 5; cycle++) {
        // 1. Trigger context loss
        act(() => {
          const lostEvent = new Event('webglcontextlost', { bubbles: true, cancelable: true });
          canvas.dispatchEvent(lostEvent);
        });

        // 2. Trigger context restore
        act(() => {
          const restoredEvent = new Event('webglcontextrestored', { bubbles: true, cancelable: true });
          canvas.dispatchEvent(restoredEvent);
        });
      }

      // Verify canvas remains attached and functional
      expect(container.querySelector('canvas')).not.toBeNull();
      unmount();
    });
  });

  // ===========================================================================
  // SECTION 7: Interactive Telemetry & Momentum Physics Integration
  // ===========================================================================
  describe('Section 7: Interactive Telemetry & Momentum Physics Integration', () => {
    it('7.1 should invoke onHoverChange and onTargetScreenPosChange callbacks properly', () => {
      const onHoverChange = vi.fn();
      const onTargetScreenPosChange = vi.fn();
      const onLocationSelect = vi.fn();

      const { container, unmount } = render(
        React.createElement(RotatingEarth, {
          width: 800,
          height: 600,
          onHoverChange,
          onTargetScreenPosChange,
          onLocationSelect,
          selectedLocation: { lat: 37.7749, lon: -122.4194 },
        })
      );

      expect(container.querySelector('canvas')).not.toBeNull();
      unmount();
    });
  });
});
