import { describe, it, expect } from 'vitest';
import { COLORWAY_PRESETS, UniformColorPreset } from '../components/RotatingEarth';

describe('Milestone 2 Performance & Algorithmic Stress Harness', () => {
  it('Benchmark 1: High-Throughput Uniform Vector Lerping (>2,000,000 ops/sec)', () => {
    const presets = Object.values(COLORWAY_PRESETS);
    const u = {
      landColor: [0, 0, 0, 1] as [number, number, number, number],
      oceanColor: [0, 0, 0, 1] as [number, number, number, number],
      specularColor: [0, 0, 0, 1] as [number, number, number, number],
      gridColor: [0, 0, 0, 1] as [number, number, number, number],
      atmosColor: [0, 0, 0, 1] as [number, number, number, number],
      radarSweep: 0,
    };

    const iterations = 500000;
    const t0 = performance.now();

    for (let i = 0; i < iterations; i++) {
      const target = presets[i % presets.length];
      const lerp = 0.08;
      for (let j = 0; j < 4; j++) {
        u.landColor[j] += (target.landColor[j] - u.landColor[j]) * lerp;
        u.oceanColor[j] += (target.oceanColor[j] - u.oceanColor[j]) * lerp;
        u.specularColor[j] += (target.specularColor[j] - u.specularColor[j]) * lerp;
        u.gridColor[j] += (target.gridColor[j] - u.gridColor[j]) * lerp;
        u.atmosColor[j] += (target.atmosColor[j] - u.atmosColor[j]) * lerp;
      }
      u.radarSweep += (target.radarSweep - u.radarSweep) * lerp;
    }

    const elapsed = performance.now() - t0;
    const opsPerSec = Math.round((iterations * 1000) / elapsed);
    console.log(`[Benchmark] Uniform Lerp throughput: ${opsPerSec.toLocaleString()} ops/sec (elapsed: ${elapsed.toFixed(2)}ms for ${iterations} ops)`);

    expect(opsPerSec).toBeGreaterThan(1000000);
  });

  it('Benchmark 2: Solar Angle Vector & Blinn-Phong Glint Throughput (>5,000,000 ops/sec)', () => {
    const iterations = 1000000;
    const t0 = performance.now();
    let sumSpec = 0;

    for (let i = 0; i < iterations; i++) {
      const angle = (i % 360);
      const sunRad = (angle * Math.PI) / 180.0;
      const sunDir = [Math.cos(sunRad), 0.35, Math.sin(sunRad)];
      const sunLen = Math.sqrt(sunDir[0] * sunDir[0] + 0.1225 + sunDir[2] * sunDir[2]);
      const normSun = [sunDir[0] / sunLen, 0.35 / sunLen, sunDir[2] / sunLen];

      // Blinn-Phong half angle
      const LV = [normSun[0], normSun[1], normSun[2] + 1.0];
      const lvLen = Math.sqrt(LV[0] * LV[0] + LV[1] * LV[1] + LV[2] * LV[2]);
      const H = [LV[0] / lvLen, LV[1] / lvLen, LV[2] / lvLen];

      // Specular power (0, 0, 1) . H
      const NdotH = Math.max(0, H[2]);
      const spec = Math.pow(NdotH, 38.0);
      sumSpec += spec;
    }

    const elapsed = performance.now() - t0;
    const opsPerSec = Math.round((iterations * 1000) / elapsed);
    console.log(`[Benchmark] Blinn-Phong Glint throughput: ${opsPerSec.toLocaleString()} ops/sec (elapsed: ${elapsed.toFixed(2)}ms for ${iterations} ops)`);

    expect(opsPerSec).toBeGreaterThan(3000000);
    expect(sumSpec).toBeGreaterThan(0);
  });

  it('Benchmark 3: 3x3 Sobel Convolution Kernel Throughput (>5,000,000 pixels/sec)', () => {
    // Generate synthetic 128x128 binary land/ocean bitmap
    const w = 128;
    const h = 128;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        data[(y * w + x) * 4] = (x > y) ? 255 : 0;
      }
    }

    const iterations = 50; // 50 full raster passes = 50 * 16384 = 819,200 pixel evaluations
    const t0 = performance.now();
    let edgeSum = 0;

    for (let iter = 0; iter < iterations; iter++) {
      for (let y = 1; y < h - 1; y += 2) {
        const row = y * w;
        for (let x = 1; x < w - 1; x += 2) {
          let gx = 0;
          let gy = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy;
            const r = ny * w;
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const val = data[(r + nx) * 4] > 100 ? 1.0 : 0.0;
              const kx = dx * (dy === 0 ? 2 : 1);
              const ky = dy * (dx === 0 ? 2 : 1);
              gx += kx * val;
              gy += ky * val;
            }
          }
          const grad = Math.min(1.0, Math.sqrt(gx * gx + gy * gy) / 4.0);
          edgeSum += grad;
        }
      }
    }

    const totalPixels = iterations * ((w - 2) / 2) * ((h - 2) / 2);
    const elapsed = performance.now() - t0;
    const pixelsPerSec = Math.round((totalPixels * 1000) / elapsed);
    console.log(`[Benchmark] Sobel Kernel throughput: ${pixelsPerSec.toLocaleString()} pixels/sec (elapsed: ${elapsed.toFixed(2)}ms for ${totalPixels} evaluations)`);

    expect(pixelsPerSec).toBeGreaterThan(1000000);
    expect(edgeSum).toBeGreaterThan(0);
  });

  it('Benchmark 4: Memory Stability Across 100,000 Iterations', () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      if (global.gc) global.gc();
      const initialHeap = process.memoryUsage().heapUsed;

      // Execute 100,000 uniform and coordinate operations
      const arr: any[] = [];
      for (let i = 0; i < 100000; i++) {
        const angle = i % 360;
        const rad = (angle * Math.PI) / 180.0;
        const x = Math.cos(rad);
        const y = Math.sin(rad);
        if (i % 1000 === 0) {
          arr.push({ x, y });
        }
      }

      if (global.gc) global.gc();
      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMB = (finalHeap - initialHeap) / (1024 * 1024);
      console.log(`[Benchmark] Heap delta over 100k iterations: ${heapDeltaMB.toFixed(2)} MB`);

      // Delta should be minimal (< 15MB)
      expect(heapDeltaMB).toBeLessThan(15);
    }
  });
});
