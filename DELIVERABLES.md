---
title: "TerraGemini — Holographic WebGL Planetary Telemetry & Cartography"
slug: "terragemini-holographic-cartography"
description: "Interactive WebGL dot-matrix planetary cartography with Blinn-Phong specular ocean glide, 3x3 Sobel coastline convolution, military MGRS telemetry, and modular React 19 exportability."
date: "2026-08-31"
type: "project"
integrity: "demo"
target_repo: "andrewvoirol.com"
threads:
  - "terragemini-shader-pipeline"
  - "tactical-telemetry-engine"
tags:
  - "Shaders"
  - "d3-geo"
  - "Canvas"
  - "Projection"
  - "Animation"
  - "React"
  - "TypeScript"
  - "Local-first"
media:
  hero_webp: "screenshots/demo.webp"
  showcase_mp4: "deliverables/demo.mp4"
  screenshots:
    - "screenshots/night-mode.png"
    - "screenshots/day-specular.png"
    - "screenshots/target-hud.png"
    - "screenshots/palette-matrix.png"
---

# TerraGemini — Holographic WebGL Planetary Telemetry & Cartography

> **Site Ingestion Package & Atomic Technical Dossier**  
> **Target Repository**: `andrewvoirol.com` (`ableandrew` / `ableandrew-site`)  
> **Integrity Mode**: `demo` (Verified offline-first execution with automated E2E test verification)  
> **Deliverables**: `deliverables/demo.mp4` (60fps H.264), `screenshots/demo.webp` (<5MB), 4 hero screenshots, modular React 19 component suite.

---

## 1. Executive Summary & Architectural Overview

TerraGemini is an interactive, browser-based WebGL planetary cartography and tactical telemetry system. Built from the ground up without heavy third-party 3D frameworks (e.g. Three.js, Babylon.js), TerraGemini executes custom GLSL shaders directly on raw WebGL contexts. It features:

1. **High-Density Topographic Point Cloud**: 50,000 to 250,000 discrete spherical surface points sampled via cosine rejection sampling ($\propto \cos(\text{lat})$) from 50m Natural Earth TopoJSON polygons rasterized onto a 4K equirectangular matrix.
2. **Dynamic Ocean Specular Glint**: Raytraced Blinn-Phong specular highlight $((\mathbf{N} \cdot \mathbf{H})^{38})$ on an oceanic quad with a scrubbable 3D sun position vector and Rayleigh limb scattering.
3. **Sobel Coastline Edge Filtering**: Real-time $3 \times 3$ normal gradient edge convolution highlighting continental shelves, islands, and maritime borders.
4. **Precision Tactical Coordinate Telemetry**: Bidirectional geodetic conversion engine supporting Military Grid Reference System (MGRS 1m precision), Universal Transverse Mercator (UTM), Decimal Degrees (DD), and Degrees-Minutes-Seconds (DMS).
5. **Interactive 3D Target Reticle**: Raycasted click targeting with 3D-to-2D forward tracking, back-hemisphere occlusion culling, animated radar lock rings, and dynamic SVG leader lines.
6. **Zero-Recompile Colorway Presets**: Instant uniform vector lerping across four visual themes (*Night Radar*, *Day Satellite*, *Cyber Cyan*, *Holographic Gold*).

```
                                 ┌────────────────────────────────────────┐
                                 │             User / Pointer             │
                                 └──────────────────┬─────────────────────┘
                                                    │
                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ React 19 Application Root (`App.tsx` / `DynamicWidget.tsx`)                                         │
│                                                                                                      │
│   ┌───────────────────────────┐      ┌──────────────────────────┐      ┌─────────────────────────┐   │
│   │ Floating Control HUD      │      │ Tactical Overlay Reticle │      │ Target Visualizer HUD   │   │
│   │ (`ControlDeck.tsx`)       │      │ (`TacticalOverlay.tsx`)  │      │ (`TargetVisualizer.tsx`)│   │
│   │ - Point Density (50k-250k)│      │ - 3D Tracking Reticle    │      │ - MGRS / DD / DMS / UTM │   │
│   │ - Solar Angle (0°-360°)   │      │ - Radar Lock Rings       │      │ - Elevation Telemetry   │   │
│   │ - 4 Colorway Presets      │      │ - Hover Crosshair        │      │ - Sector Grid Codes     │   │
│   │ - Sobel Edge Sensitivity  │      │ - SVG Dynamic Leader     │      │ - Target Lock States    │   │
│   │ - Orbit / Friction Tuning │      └───────────▲──────────────┘      └───────────▲─────────────┘   │
│   └─────────────┬─────────────┘                  │                                 │                 │
│                 │                                │ (Screen Coordinates)            │                 │
│                 ▼                                │                                 │                 │
│   ┌──────────────────────────────────────────────┴─────────────────────────────────┴─────────────┐   │
│   │ `RotatingEarth.tsx` (Modular, Self-Contained WebGL Canvas Engine)                            │   │
│   │                                                                                              │   │
│   │   ┌────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐   │   │
│   │   │ Pre-Ranked Point Cloud │  │ Ocean Specular Mesh     │  │ Graticule & Markers         │   │   │
│   │   │ 250k Points Buffer     │  │ Blinn-Phong Glint       │  │ Raycasted Screen Pick       │   │   │
│   │   │ Dynamic Range Slicing  │  │ Solar Uniform Vector    │  │ Pointer Capture API         │   │   │
│   │   └────────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘   │   │
│   │                                                                                              │   │
│   │   ┌────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────────┐   │   │
│   │   │ 4 Colorway Uniforms    │  │ Sobel Edge Convolution  │  │ Lifecycle & Context Manager │   │   │
│   │   │ Zero-Recompile Lerp    │  │ 3x3 Gradient Kernel     │  │ ResizeObserver / Disposal   │   │   │
│   │   └────────────────────────┘  └─────────────────────────┘  └─────────────────────────────┘   │   │
│   └──────────────────────────────────────────────┬───────────────────────────────────────────────┘   │
│                                                  │                                                   │
│   ┌──────────────────────────────────────────────┴───────────────────────────────────────────────┐   │
│   │ Coordinate Math & Projection Engines (`utils/`)                                              │   │
│   │ - `coordinates.ts`: WGS84 -> MGRS (1m precision), UTM, DD, DMS formatters                   │   │
│   │ - `projection.ts`: Screen-to-Sphere Raycasting & 3D-to-Screen Forward Projection            │   │
│   │ - `elevation.ts`: Topographic classification & normalized altitude estimation                │   │
│   └──────────────────────────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Atomic Build Log 1: WebGL Shader Pipeline & Uniform Control Deck

### Problem
In standard WebGL applications, changing visual styles or dynamically scaling point cloud density often triggers shader re-compilations (causing noticeable frame drops or hitching) or requires expensive CPU re-rasterization and vertex buffer re-allocations on every slider movement.

### Engineering Solution

#### 1. Zero-Recompile Colorway Transitions
Instead of swapping shader programs or altering preprocessor macros `#ifdef`, TerraGemini routes all visual parameters through a consolidated uniform state object. On every frame, the uniform state vector smoothly lerps toward target presets at a fixed exponential decay rate ($\alpha = 0.08$):

```typescript
// Smooth uniform vector lerping (zero re-linking, zero GC allocation)
const lerpFactor = 0.08;
for (let i = 0; i < 4; i++) {
  u.landColor[i] += (targetPreset.landColor[i] - u.landColor[i]) * lerpFactor;
  u.oceanColor[i] += (targetPreset.oceanColor[i] - u.oceanColor[i]) * lerpFactor;
  u.specularColor[i] += (targetPreset.specularColor[i] - u.specularColor[i]) * lerpFactor;
  u.gridColor[i] += (targetPreset.gridColor[i] - u.gridColor[i]) * lerpFactor;
  u.atmosColor[i] += (targetPreset.atmosColor[i] - u.atmosColor[i]) * lerpFactor;
}
u.radarSweep += (targetPreset.radarSweep - u.radarSweep) * lerpFactor;
u.solarAngle += ((p.solarAngle ?? 45) - u.solarAngle) * 0.1;
u.edgeSensitivity += ((p.edgeSensitivity ?? 0.5) - u.edgeSensitivity) * 0.1;
```

#### 2. $O(1)$ GPU Vertex Buffer Slicing for 250,000 Dynamic Points
During the initial initialization pass, 250,000 points are generated, prioritized using importance ranking (edge gradient + spatial distribution), and uploaded to the GPU as a single static interleaved vertex buffer `[lon, lat, edge_strength, rank]` (16 bytes per vertex).

When the user adjusts the point density slider:
- No CPU memory is reallocated.
- No data is uploaded over the PCIe/GPU bus (`gl.bufferData` is never called during slider drags).
- The WebGL draw call simply slices the active point count $N$:
  $$\text{renderPoints} = \operatorname{clamp}(\text{activeCount}, 50000, 250000)$$
  $$\text{gl.drawArrays}(\text{gl.POINTS}, 0, \text{renderPoints})$$

This achieves perfectly smooth 60 FPS slider response even under rapid user scrubbing.

---

## 3. Atomic Build Log 2: Blinn-Phong Specular Reflection Math & Solar Lighting

### Vector Derivation

The oceanic reflection is rendered using a raytraced billboard quad covering the screen-space bounding disc of the planet ($u^2 + v^2 \le 1.0$).

```
                Sun (L)
                   \           Normal (N)
                    \             |
                     \            |
                      \           |       View / Camera (V)
                       \          |          /
                        \         |         /
                         \        |  Half  /
                          \       | Vector/
                           \      |  (H) /
                            \     |  /  /
                             \    | /  /
                              \   |/  /
       ═════════════════════════[•]═════════════════════════ Ocean Surface
```

#### 1. Spherical Normal Reconstruction
For any screen fragment with normalized coordinate $(u, v) \in [-1, 1]^2$:
$$r^2 = u^2 + v^2$$
If $r^2 > 1.0$, the fragment is outside the spherical globe and discarded via `discard`. Otherwise, the unit normal $\mathbf{N}$ on the sphere surface is:
$$\mathbf{N} = \begin{pmatrix} u \\ -v \\ \sqrt{1.0 - r^2} \end{pmatrix}$$

#### 2. Solar Direction Vector ($\mathbf{L}$)
Given solar azimuth angle $\theta_{\text{sun}} \in [0, 2\pi]$ and constant solar elevation angle $\alpha = 0.35\text{ rad}$:
$$\mathbf{L}_{\text{raw}} = \begin{pmatrix} \cos(\theta_{\text{sun}}) \\ 0.35 \\ \sin(\theta_{\text{sun}}) \end{pmatrix}, \quad \mathbf{L} = \frac{\mathbf{L}_{\text{raw}}}{\|\mathbf{L}_{\text{raw}}\|}$$

#### 3. Half-Angle Vector ($\mathbf{H}$) & Specular Intensity
With camera view vector aligned with the screen normal $\mathbf{V} = (0, 0, 1)^T$, the Blinn-Phong half-angle vector is:
$$\mathbf{H} = \frac{\mathbf{L} + \mathbf{V}}{\|\mathbf{L} + \mathbf{V}\|}$$

The specular intensity $I_{\text{spec}}$ is computed with a specular exponent $s = 38.0$:
$$I_{\text{spec}} = (\max(\mathbf{N} \cdot \mathbf{H}, 0.0))^{38} \cdot \mathcal{H}(\mathbf{N} \cdot \mathbf{L})$$
where $\mathcal{H}(x)$ is the Heaviside step function (`step(0.001, NdotL)`), ensuring that the dark side of the globe receives zero specular glint.

#### 4. Rayleigh Atmospheric Limb Scattering & Radar Sweep
The atmospheric rim scattering intensity $I_{\text{limb}}$ and radar sweep modulation $I_{\text{sweep}}$ are formulated as:
$$I_{\text{limb}} = (1.0 - z)^{2.6}, \quad z = \sqrt{1.0 - r^2}$$
$$I_{\text{sweep}} = \exp\left(-\operatorname{mod}(\theta_{\text{frag}} - \theta_{\text{sweep}} + 2\pi, 2\pi) \cdot 3.5\right) \cdot u_{\text{radar\_sweep}}$$

The final composited fragment color $\mathbf{C}_{\text{final}}$ is:
$$\mathbf{C}_{\text{final}} = \mathbf{C}_{\text{ocean}} \cdot (0.18 + 0.82(\mathbf{N} \cdot \mathbf{L})) + \mathbf{C}_{\text{specular}} \cdot (1.85 \cdot I_{\text{spec}}) + \mathbf{C}_{\text{atmos}} \cdot (0.75 \cdot I_{\text{limb}} + 0.35 \cdot I_{\text{sweep}})$$

---

## 4. Atomic Build Log 3: Sobel Edge Convolution & Normal Gradient Filter

### Mathematical Formulation

To accentuate natural coastlines, island arcs, and continental boundaries, the 4K raster matrix $I(x, y)$ is evaluated with a discrete $3 \times 3$ Sobel convolution filter:

$$G_x = \begin{bmatrix} -1 & 0 & +1 \\ -2 & 0 & +2 \\ -1 & 0 & +1 \end{bmatrix} * I(x, y), \quad G_y = \begin{bmatrix} -1 & -2 & -1 \\ 0 & 0 & 0 \\ +1 & +2 & +1 \end{bmatrix} * I(x, y)$$

The normalized edge magnitude $S_{\text{edge}} \in [0, 1]$ is:
$$S_{\text{edge}}(x, y) = \min\left(1.0, \frac{\sqrt{G_x(x, y)^2 + G_y(x, y)^2}}{4.0}\right)$$

```typescript
function computeSobelGradient(x: number, y: number, w: number, h: number, data: Uint8ClampedArray): number {
  let gx = 0;
  let gy = 0;
  for (let dy = -1; dy <= 1; dy++) {
    const ny = Math.max(0, Math.min(h - 1, y + dy));
    const row = ny * w;
    for (let dx = -1; dx <= 1; dx++) {
      const nx = Math.max(0, Math.min(w - 1, x + dx));
      const val = data[(row + nx) * 4] > 100 ? 1.0 : 0.0;
      const kx = dx * (dy === 0 ? 2 : 1);
      const ky = dy * (dx === 0 ? 2 : 1);
      gx += kx * val;
      gy += ky * val;
    }
  }
  return Math.min(1.0, Math.sqrt(gx * gx + gy * gy) / 4.0);
}
```

### Dynamic Shader Coastline Modulation

In the vertex and fragment shaders, the uniform `u_edge_sensitivity` dynamically modulates point scale and color intensity at coastlines:
$$\text{Threshold} = 1.0 - (u_{\text{edge\_sensitivity}} \cdot 0.85 + 0.08)$$
$$\text{EdgeFactor} = \operatorname{smoothstep}(\text{Threshold}, 1.0, a_{\text{edge\_strength}})$$
$$\text{PointSize} = \operatorname{clamp}\left(s_{\text{base}} \cdot \text{Fresnel} \cdot (1.0 + 1.6 \cdot \text{EdgeFactor} \cdot u_{\text{edge\_sensitivity}}), 1.0, 64.0\right)$$

This delivers sharp, crisp continental boundaries without introducing polygon aliasing or geometric artifacts.

---

## 5. Atomic Build Log 4: 3D Spherical Unprojection & Tactical Telemetry Engine

### 1. Screen-to-Sphere Raycasting (Unprojection)

When the user interacts with the canvas at screen pixel coordinate $(x_s, y_s)$:
1. Transform screen coordinates to normalized coordinates relative to canvas center $(c_x, c_y)$ and pixel scale $S$:
   $$r_x = \frac{x_s - c_x}{S}, \quad r_y = -\frac{y_s - c_y}{S}$$
2. Verify intersection: if $r_x^2 + r_y^2 > 1.0$, the ray misses the unit sphere and returns `null`.
3. Compute front-hemisphere $Z$-depth:
   $$r_z = \sqrt{1.0 - (r_x^2 + r_y^2)}$$
4. Apply the inverse camera rotation matrix $\mathbf{R}^{-1} = R_y(-\theta_y) R_x(-\theta_x)$:
   $$\begin{pmatrix} p_x \\ p_y \\ p_z \end{pmatrix} = \begin{pmatrix} \cos(-\theta_y) & 0 & \sin(-\theta_y) \\ 0 & 1 & 0 \\ -\sin(-\theta_y) & 0 & \cos(-\theta_y) \end{pmatrix} \begin{pmatrix} 1 & 0 & 0 \\ 0 & \cos(-\theta_x) & -\sin(-\theta_x) \\ 0 & \sin(-\theta_x) & \cos(-\theta_x) \end{pmatrix} \begin{pmatrix} r_x \\ r_y \\ r_z \end{pmatrix}$$
5. Extract geodetic latitude $\phi$ and longitude $\lambda$:
   $$\phi = \arcsin\left(\operatorname{clamp}(p_y, -1.0, 1.0)\right) \cdot \frac{180}{\pi}$$
   $$\lambda = \operatorname{atan2}(p_x, p_z) \cdot \frac{180}{\pi}$$

### 2. Forward 3D-to-2D Sphere-to-Screen Projection

To continuously anchor UI elements (e.g., radar lock rings, SVG leader lines) to a locked surface target $(\phi_t, \lambda_t)$:
1. Surface Cartesian point: $\mathbf{p} = (\cos\phi_t \sin\lambda_t, \, \sin\phi_t, \, \cos\phi_t \cos\lambda_t)^T$.
2. Rotated point: $\mathbf{p}' = R_x(\theta_x) R_y(\theta_y) \mathbf{p}$.
3. Screen projection: $x_s = c_x + p'_x \cdot S$, $y_s = c_y - p'_y \cdot S$.
4. Occlusion culling: $\text{isVisible} = (p'_z > 0.0)$.

### 3. Geodetic Coordinate Conversion Engine (WGS84 to MGRS, UTM, DD, DMS)

TerraGemini incorporates an exact WGS84 ellipsoid geodetic transformation engine ($a = 6378137.0\text{ m}, f = 1/298.257223563$):

- **UTM Engine**: Computes meridian arc distance $M$, radius of curvature in prime vertical $N$, central scale factor $k_0 = 0.9996$, and 5th-order series expansions for easting ($+500{,}000\text{m}$) and northing ($+10{,}000{,}000\text{m}$ in southern hemisphere).
- **MGRS Engine**: Derives the 6° UTM zone, 8° latitude band letter, 100,000m grid identification letters (using DoD/NGA row letter offset sets), and 5-digit easting/northing string formatted to 1-meter military precision (e.g. `18T WL 83959 07350`).

```typescript
export function latLonToMGRS(lat: number, lon: number, precision: number = 5): string {
  const utm = latLonToUTM(lat, lon);
  if (utm.zoneNumber === 0 || !utm.band) return '';

  const setIndex = (utm.zoneNumber - 1) % 3;
  const colIndex = Math.floor(utm.easting / 100000.0) - 1;
  const colLetter = MGRS_COL_SETS[setIndex].charAt(Math.max(0, Math.min(7, colIndex)));

  const rowOffset = utm.zoneNumber % 2 === 0 ? 5 : 0;
  const rowIndex = (Math.floor((utm.northing % 2000000.0) / 100000.0) + rowOffset) % 20;
  const rowLetter = MGRS_ROW_LETTERS.charAt(rowIndex);

  const divisor = Math.pow(10, 5 - precision);
  const eastingStr = Math.floor((utm.easting % 100000.0) / divisor).toString().padStart(precision, '0');
  const northingStr = Math.floor((utm.northing % 100000.0) / divisor).toString().padStart(precision, '0');

  return `${utm.zoneNumber}${utm.band} ${colLetter}${rowLetter} ${eastingStr} ${northingStr}`;
}
```

---

## 6. Drop-in Integration Guide for `andrewvoirol.com`

### Component File Manifest

To integrate the TerraGemini planetary telemetry widget into `andrewvoirol.com` (`ableandrew`), copy the following standalone modules:

```
src/components/cartography/
├── RotatingEarth.tsx      # Core WebGL canvas & shader rendering engine
├── ControlDeck.tsx        # Glassmorphic shader control deck HUD
├── TacticalOverlay.tsx    # 3D target lock reticle, radar rings & SVG leader
├── TargetVisualizer.tsx   # Coordinate telemetry card (MGRS/UTM/DD/DMS)
└── BootSequence.tsx       # Holographic BIOS boot terminal animation

src/lib/cartography/
├── types.ts              # TypeScript interfaces & contracts
├── coordinates.ts        # WGS84 to MGRS, UTM, DD, DMS conversion engine
├── projection.ts         # 3D-to-Screen & Screen-to-Sphere raycast math
└── elevation.ts          # Topographic elevation classification model

public/
└── land-50m.json         # 50m Natural Earth TopoJSON geometry (cached locally)
```

### Next.js 15+ / React 19 Client Component Integration

Because WebGL requires direct browser canvas access (`WebGLRenderingContext`), embed `RotatingEarth` in Next.js using `next/dynamic` with `{ ssr: false }`.

```tsx
// src/components/cartography/TerraGeminiWidget.tsx
'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import type { Coordinates, ColorwayPalette, HoverTelemetry } from '@/lib/cartography/types';

// Dynamically import client-only WebGL canvas
const RotatingEarth = dynamic(() => import('./RotatingEarth'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] w-full items-center justify-center bg-slate-950 text-cyan-400 font-mono text-sm">
      <span className="animate-pulse">INITIALIZING WEBGL PLANETARY TELEMETRY...</span>
    </div>
  ),
});

const ControlDeck = dynamic(() => import('./ControlDeck').then((m) => m.ControlDeck), { ssr: false });
const TacticalOverlay = dynamic(() => import('./TacticalOverlay').then((m) => m.TacticalOverlay), { ssr: false });
const TargetVisualizer = dynamic(() => import('./TargetVisualizer').then((m) => m.TargetVisualizer), { ssr: false });

export default function TerraGeminiWidget() {
  const [palette, setPalette] = useState<ColorwayPalette>('cyber_cyan');
  const [pointDensity, setPointDensity] = useState<number>(150000);
  const [solarAngle, setSolarAngle] = useState<number>(135);
  const [edgeSensitivity, setEdgeSensitivity] = useState<number>(0.5);
  const [autoOrbit, setAutoOrbit] = useState<boolean>(true);
  const [orbitSpeed, setOrbitSpeed] = useState<number>(0.3);
  const [dragFriction, setDragFriction] = useState<number>(0.94);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [hoverTelemetry, setHoverTelemetry] = useState<HoverTelemetry | null>(null);
  const [targetScreenPos, setTargetScreenPos] = useState<{
    x: number;
    y: number;
    depth: number;
    isVisible: boolean;
  } | null>(null);
  const [cardPos, setCardPos] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  return (
    <div className="relative w-full h-[700px] overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-950 shadow-2xl">
      {/* 1. Raw WebGL Holographic Globe */}
      <RotatingEarth
        palette={palette}
        pointDensity={pointDensity}
        solarAngle={solarAngle}
        edgeSensitivity={edgeSensitivity}
        autoOrbit={autoOrbit}
        orbitSpeed={orbitSpeed}
        dragFriction={dragFriction}
        selectedLocation={selectedLocation}
        onLocationSelect={setSelectedLocation}
        onHoverChange={setHoverTelemetry}
        onTargetScreenPosChange={setTargetScreenPos}
        className="w-full h-full"
      />

      {/* 2. 3D Surface Target Reticle & SVG Dynamic Leader */}
      <TacticalOverlay
        targetScreenPos={targetScreenPos}
        selectedCoords={selectedLocation}
        hoverTelemetry={hoverTelemetry}
        palette={palette}
        targetCardPosition={cardPos}
      />

      {/* 3. Tactical Coordinate Telemetry Card */}
      <div className="absolute top-4 left-4 z-20 pointer-events-auto">
        <TargetVisualizer
          coords={selectedLocation}
          hoverTelemetry={hoverTelemetry}
          palette={palette}
          onCardPositionChange={setCardPos}
        />
      </div>

      {/* 4. Glassmorphic Shader Control Deck */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
        <ControlDeck
          palette={palette}
          onPaletteChange={setPalette}
          pointDensity={pointDensity}
          onPointDensityChange={setPointDensity}
          solarAngle={solarAngle}
          onSolarAngleChange={setSolarAngle}
          edgeSensitivity={edgeSensitivity}
          onEdgeSensitivityChange={setEdgeSensitivity}
          autoOrbit={autoOrbit}
          onAutoOrbitChange={setAutoOrbit}
          orbitSpeed={orbitSpeed}
          onOrbitSpeedChange={setOrbitSpeed}
          dragFriction={dragFriction}
          onDragFrictionChange={setDragFriction}
        />
      </div>
    </div>
  );
}
```

### TypeScript Props Contract (`RotatingEarthProps`)

```typescript
export interface RotatingEarthProps {
  // Dimensions & Styling
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;

  // Shader Controls (R1)
  palette?: 'night_radar' | 'day_satellite' | 'cyber_cyan' | 'holographic_gold';
  pointDensity?: number;      // 50,000 to 250,000 points
  solarAngle?: number;        // 0 to 360 degrees
  edgeSensitivity?: number;   // 0.0 to 1.0

  // Physics & Navigation
  autoOrbit?: boolean;
  orbitSpeed?: number;
  dragFriction?: number;
  interactive?: boolean;

  // Selection & Telemetry Callbacks (R2)
  selectedLocation?: Coordinates | null;
  onLocationSelect?: (coords: Coordinates) => void;
  onHoverChange?: (telemetry: HoverTelemetry | null) => void;
  onTargetScreenPosChange?: (screenPos: { x: number; y: number; depth: number; isVisible: boolean } | null) => void;
  onViewChange?: (view: { lat: number; lon: number; scale: number; fps: number }) => void;
  onReady?: () => void;
}
```

### Tailwind CSS Configuration Tokens

Ensure your Tailwind CSS configuration (`tailwind.config.js` or `tailwind.config.ts`) includes the following font families, keyframe animations, and custom blur utilities:

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
export default config;
```

---

## 7. Quality Certification & Test Verification Matrix

TerraGemini undergoes automated testing across unit, integration, lifecycle resilience, and adversarial challenger suites:

| Test Suite | File | Tests | Status | Verification Scope |
|---|---|:---:|:---:|---|
| **Tier 1: Smoke & WebGL Context** | `tests/tier1-smoke.spec.ts` | 7 | PASS | DOM mounting, Canvas WebGL context, shader linking, GL error zero-check |
| **Tier 2: Math & Shader Controls** | `tests/tier2-math-controls.spec.ts` | 13 | PASS | 50k-250k point density, solar angle, 4 colorways, Sobel slider, MGRS/UTM math |
| **Tier 3: Lifecycle & Context Loss** | `tests/tier3-component-lifecycle.spec.ts` | 5 | PASS | ResizeObserver, WebGL context loss/restore, zero memory leaks on unmount |
| **Tier 4: Deliverables & Media** | `tests/tier4-deliverables-media.spec.ts` | 8 | PASS | `demo.mp4` (H.264), `demo.webp` (<5MB), 4 hero PNGs, README & DELIVERABLES validation |
| **Milestone 1 Core Math** | `tests/adversarial-milestone1.spec.ts` | 15 | PASS | Geodesic distance, bearing, WGS84 singularity points (poles/antimeridian), heap stability |
| **Milestone 1 Adversarial Suite** | `tests/adversarial-m1.spec.ts` | 15 | PASS | MGRS DoD/NGA 100k square row offsets, Norway/Svalbard zone overrides |
| **Milestone 2 Shader Pipeline** | `tests/adversarial-milestone2.spec.ts` | 29 | PASS | 25+ mount/unmount stress cycles, uniform vector lerping, context loss recovery |
| **Milestone 2 Benchmarks** | `tests/m2-challenger-benchmarks.spec.ts` | 13 | PASS | 60 FPS frame time budgets, Cosine rejection distribution verification |
| **Milestone 3 UI & Telemetry** | `tests/milestone3-ui-telemetry.spec.tsx` | 12 | PASS | Control Deck sliders, Target Visualizer MGRS/DD toggling, SVG leader line |
| **Milestone 3 Challenger Suite** | `tests/adversarial-milestone3.spec.tsx` | 20 | PASS | Rapid prop mutation stress, DOM unmount listener hygiene, theme token compliance |
| **Total Test Coverage** | **10 Test Suites** | **137** | **100% PASS** | **Complete opaque-box & white-box verification** |

### Independent Verification Commands

```bash
# 1. Run Tier 4 Deliverables & Documentation Validation
npx vitest run tests/tier4-deliverables-media.spec.ts

# 2. Run Full 10-Suite Automated Test Harness
npm test

# 3. Verify TypeScript Compilation & Production Build
npx tsc --noEmit
npm run build
```

---

## 8. Provenance & Attribution

- **Lead Architect & Engineer**: Andrew Voirol
- **Core Technology**: WebGL / GLSL, React 19, TypeScript 5.8, Tailwind CSS 3, Vite 6, D3-Geo, TopoJSON
- **Integrity Level**: Flagship Showcase (`demo` mode, zero external window dependencies, 100% offline-first execution)
- **Licensing**: MIT License
