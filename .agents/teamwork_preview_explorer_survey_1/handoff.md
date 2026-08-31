# WebGL Core & Shader Architecture Survey Report
**Project:** TerraGemini (`ais-terragemini`)  
**Explorer:** Explorer 1 (WebGL Core & Shader Architecture)  
**Date:** 2026-08-31  
**Scope:** R1 (Interactive Shader & Lighting Control Deck) and R3 (Modular Standalone Component Architecture)

---

## 1. Observation

### 1.1 WebGL Architecture in `components/RotatingEarth.tsx`
A thorough inspection of `components/RotatingEarth.tsx` (919 lines) reveals the following technical reality:

1. **Context Initialization (`components/RotatingEarth.tsx:365`):**
   ```ts
   const gl = canvas.getContext('webgl', { alpha: false, antialias: true })
   ```
   Uses standard WebGL 1.0. No fallback to WebGL 2.0 or context loss event bindings (`webglcontextlost`, `webglcontextrestored`).

2. **Shader Programs & GLSL Uniforms:**
   - **`progDots` (`VS_DOTS` / `FS_DOTS`, lines 31–117):**
     - Vertex shader projects 2D `[lon, lat]` in degrees to a 3D unit sphere (`clat = cos(lat); p = vec3(clat * sin(lon), sin(lat), clat * cos(lon))`).
     - Applies rotation via 3x3 Euler matrices (`rotateY`, `rotateX`).
     - Discards backside vertices using `if (rotated.z < 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`.
     - Applies Fresnel curvature size attenuation (`smoothstep(0.0, 0.3, rotated.z)`).
     - Fragment shader draws circular anti-aliased points via `gl_PointCoord * 2.0 - 1.0` and `smoothstep(0.8, 1.0, dist)`.
   - **`progLines` (`VS_LINES` / `FS_LINES`, lines 119–169):**
     - Renders a 10° graticule line grid (`d3-geo` `geoGraticule().step([10, 10])()`).
   - **`progMarker` (`VS_MARKER` / `FS_MARKER`, lines 172–273):**
     - Renders target pin extruded along normal with pulsing shockwave ring and star flare.
   - **Background Stars:**
     - 2,000 points randomly distributed over sphere radius and drawn with `progDots`.

3. **Point Cloud Generation (`components/RotatingEarth.tsx:428–552`):**
   - Fetches 50m TopoJSON (`world-atlas@2/land-50m.json`) with browser Cache API fallback (`terragemini-maps-v1`).
   - Rasterizes land polygons to an offscreen 2D canvas ($4096 \times 2048$).
   - Scans raster with a hardcoded `step = 2`, testing `imgData[i] > 100`.
   - Uses Cosine Rejection Sampling (`if (Math.random() > Math.cos(lat * (Math.PI / 180))) continue;`) to maintain uniform spatial point density across polar and equatorial latitudes.
   - Pushes all points to `coords: number[]` (~150,000 points) and uploads once via `gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW)`.
   - **Observation:** Point count is completely static (~150k). There is no mechanism to scale between 50k and 250k points dynamically.

4. **Ocean Rendering & Specular Lighting:**
   - **Observation:** There is **NO ocean shader or mesh** currently implemented.
   - Oceans are rendered as empty black canvas pixels (`gl.clearColor(0.02, 0.02, 0.02, 1.0)`).
   - There is no solar position uniform (`u_sun_dir` or `u_sun_pos`), no Blinn-Phong specular reflection calculation, and no solar glint glide across ocean basins.

5. **Colorway Palettes (`components/RotatingEarth.tsx:566–587`):**
   - Currently hardcodes only two color states:
     ```ts
     const DAY_DOT = [0.3, 0.6, 1.0];
     const NIGHT_DOT = [1.0, 0.7, 0.3];
     ```
   - Toggled via a single boolean `isNightMode` with a 1D scalar lerp `s.themeTransition += (targetT - s.themeTransition) * 0.05`.
   - Presets 1 (*Night Radar*), 2 (*Day Satellite*), 3 (*Cyber Cyan*), and 4 (*Holographic Gold*) are not implemented.

6. **Coastline Filtering & Sobel Convolution:**
   - **Observation:** There is **NO Sobel edge convolution kernel or normal gradient sensitivity filter** in the codebase.
   - Points are extracted purely on binary raster threshold `imgData[i] > 100`.

7. **Physics & Interaction (`components/RotatingEarth.tsx:622–641, 830–870`):**
   - Damped momentum physics is hardcoded: `s.velocity[0] *= 0.96; s.velocity[1] *= 0.96;`.
   - Auto-spin kicks in automatically when idle: `if (Math.abs(s.velocity[0]) < 0.2) s.velocity[0] += (0.8 - s.velocity[0]) * 0.01;`.
   - No HUD controls or props exist to toggle auto-orbit or adjust friction/speed.
   - Event listeners are attached to `document` on every `mousedown` (`document.addEventListener('mousemove', onMove)`) without PointerEvent capture or touch event support.

8. **Memory Allocations in Render Loop (`components/RotatingEarth.tsx:721–748`):**
   - When a location marker is active, the render loop executes:
     ```ts
     const data = new Float32Array([...]);
     gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
     const beamPoints = [];
     for (let i = 0; i <= 20; i++) { beamPoints.push(s.selectedLocation.lon, s.selectedLocation.lat, i / 20); }
     gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(beamPoints), gl.DYNAMIC_DRAW);
     ```
   - **Observation:** 60 allocations per second of JavaScript arrays, TypedArrays, and GPU buffer re-specifications inside the active render loop, causing garbage collection spikes.

9. **Lifecycle & Cleanup (`components/RotatingEarth.tsx:357–423`):**
   - The WebGL setup `useEffect` has an empty cleanup return. It does not call `gl.deleteProgram`, `gl.deleteBuffer`, or `gl.deleteShader` on unmount.
   - React 19 StrictMode remounting or dynamic unmount leaves orphaned WebGL contexts and GPU buffers in memory.

---

## 2. Logic Chain

1. **Point Cloud Scaling (50k to 250k dynamic scaling):**
   - *Premise:* Generating 250,000 points from 2D canvas raster takes ~400–800ms of CPU time.
   - *Logic:* Re-running canvas rasterization or re-allocating GPU buffers during slider drag would drop frame rates from 60 FPS to <5 FPS (unacceptable UI hitching).
   - *Solution:* Generate the maximum density buffer (250,000 points) once during initialization. Pack an attribute `a_importance` / `a_rank` ($0.0 \le \text{rank} \le 1.0$) with each vertex, sorted or indexed by importance rank.
   - *GPU Execution:* When the user moves the density slider to $N$ points ($50\text{k} \le N \le 250\text{k}$), the render loop calls `gl.drawArrays(gl.POINTS, 0, N)`.
   - *Result:* Zero CPU rasterization overhead, zero GPU buffer re-allocation, 60 FPS instant response during real-time slider scrubbing.

2. **Specular Lighting & 2K Solar Glide Mechanics:**
   - *Premise:* Oceans currently lack visual depth because no ocean geometry or specular shader exists.
   - *Logic:* High-resolution holographic cartography requires ocean basins to reflect the solar light source with an authentic specular highlight.
   - *Formulation:*
     - Introduce an Ocean Raytraced Sphere / Atmosphere Fragment Quad or dedicated Ocean Mesh program.
     - For screen-space coordinate $\mathbf{u} = \frac{\mathbf{x}_{\text{screen}} - \mathbf{c}}{\text{scale}}$, compute sphere depth $z_s = \sqrt{1.0 - |\mathbf{u}|^2}$ for $|\mathbf{u}| \le 1.0$.
     - Compute surface normal $\mathbf{N} = (\mathbf{u}_x, -\mathbf{u}_y, z_s)$.
     - Let $\mathbf{L}$ be the normalized Sun direction vector controlled by `u_sun_azimuth` ($\theta$) and `u_sun_elevation` ($\phi$):
       $$\mathbf{L} = \begin{pmatrix} \cos\phi \sin\theta \\ \sin\phi \\ \cos\phi \cos\theta \end{pmatrix}$$
     - In screen space, view direction $\mathbf{V} = (0, 0, 1)$. Half-angle vector $\mathbf{H} = \frac{\mathbf{L} + \mathbf{V}}{|\mathbf{L} + \mathbf{V}|}$.
     - Blinn-Phong specular term:
       $$I_{\text{spec}} = (\max(\mathbf{N} \cdot \mathbf{H}, 0.0))^{s_{\text{shininess}}}$$
     - Diffuse irradiance: $I_{\text{diff}} = \max(\mathbf{N} \cdot \mathbf{L}, 0.0)$.
     - Combine with ocean base color and Rayleigh limb scattering:
       $$\mathbf{C}_{\text{ocean}} = \mathbf{C}_{\text{base}} \cdot (k_a + k_d I_{\text{diff}}) + \mathbf{C}_{\text{spec}} \cdot I_{\text{spec}} + \mathbf{C}_{\text{atmos}} \cdot (1.0 - \mathbf{N}_z)^3$$
   - *Result:* Scrubbing the solar angle slider produces a smooth solar reflection glint gliding across oceanic regions in real time.

3. **Instant 4-Colorway Switching without Recompilation Hitching:**
   - *Premise:* Calling `gl.compileShader` or `gl.linkProgram` on preset change halts the WebGL command pipeline for 50–150ms.
   - *Logic:* All 4 presets (*Night Radar*, *Day Satellite*, *Cyber Cyan*, *Holographic Gold*) share identical mathematical structures (land dot color, graticule color, ocean base, specular glint, atmospheric corona, and radar sweep).
   - *Uniform Architecture:* Define a unified uniform block:
     - `uniform vec4 u_color_land;`
     - `uniform vec4 u_color_ocean;`
     - `uniform vec4 u_color_specular;`
     - `uniform vec4 u_color_grid;`
     - `uniform vec4 u_color_atmos;`
     - `uniform float u_radar_sweep;`
   - In JavaScript, define the 4 preset parameter matrices and smoothly interpolate uniform values in the render loop (`targetColor` lerping).
   - *Result:* Instantaneous theme switching with zero pipeline recompilation and smooth aesthetic color blending.

4. **Coastline Sobel Convolution & Normal Gradient Sensitivity:**
   - *Premise:* Coastlines define geographic boundaries and need adjustable visual emphasis.
   - *Logic:* During offscreen raster processing, apply standard $3 \times 3$ horizontal and vertical Sobel convolution kernels:
     $$G_x = \begin{bmatrix} -1 & 0 & +1 \\ -2 & 0 & +2 \\ -1 & 0 & +1 \end{bmatrix} * I, \quad G_y = \begin{bmatrix} -1 & -2 & -1 \\ 0 & 0 & 0 \\ +1 & +2 & +1 \end{bmatrix} * I$$
     $$G_{\text{edge}} = \sqrt{G_x^2 + G_y^2}$$
   - Pack $G_{\text{edge}} \in [0.0, 1.0]$ into vertex attribute buffer (`a_edge_strength`).
   - In vertex/fragment shaders, evaluate:
     $$\text{edgeFactor} = \text{smoothstep}(1.0 - u_{\text{edge\_sensitivity}}, 1.0, a_{\text{edge\_strength}})$$
   - Modulate point size and luminance: $\text{size} = \text{baseSize} \cdot (1.0 + 1.8 \cdot \text{edgeFactor})$.
   - *Result:* Real-time slider dynamically amplifies or attenuates coastal edges without CPU re-computation.

5. **Physics, Interaction, and Component Modularization (R3):**
   - Replace brittle `document.addEventListener` with W3C Pointer Events (`onPointerDown`, `setPointerCapture`, `onPointerMove`, `onPointerUp`).
   - Pre-allocate static marker/beam vertex buffers outside the render loop; use `gl.bufferSubData` or indexed transforms to eliminate per-frame GC allocations.
   - Expose clean props: `palette`, `pointDensity`, `solarAngle`, `edgeSensitivity`, `autoOrbit`, `orbitSpeed`, `friction`, `showControls`, `onTelemetryUpdate`.
   - Implement full WebGL resource cleanup (`gl.deleteBuffer`, `gl.deleteProgram`, `gl.deleteTexture`, `gl.getExtension('WEBGL_lose_context')?.loseContext()`) on unmount.

---

## 3. Caveats

1. **TopoJSON Network Dependency:**
   - The app fetches `world-atlas@2/land-50m.json` over CDN. While the Cache API provides local caching after the first fetch, offline/initial load requires network access or a local fallback bundle in `public/`.
2. **GPU Performance on Low-End Mobile Devices:**
   - Rendering 250,000 points at 60 FPS with point anti-aliasing is lightweight on modern desktop GPUs (<5% utilization on Apple Silicon), but on low-end mobile devices (Mali-G52, old Adreno), point rasterization overdraw can impact fill rate. The density slider default should start at 120k–150k.
3. **WebGL 1.0 Float Attributes & Point Size Limits:**
   - WebGL 1.0 has hardware-dependent `gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)`. Maximum point size is typically 64px–512px. Shader code must clamp point sizes within `[1.0, 64.0]`.

---

## 4. Conclusion

The existing `RotatingEarth.tsx` provides a solid starting baseline with its TopoJSON raster sampling, cosine rejection algorithm, and basic sphere projection. However, significant architectural additions are required to fulfill R1 and R3:

| Feature / Subsystem | Current State | Target State (R1 & R3) | Gap Assessment |
|---|---|---|---|
| **Point Cloud Density** | Fixed ~150k static buffer | Dynamic 50k–250k real-time scaling via ranked vertex arrays | High priority; requires pre-ranked point generation |
| **Specular Solar Glide** | Non-existent; black ocean background | Blinn-Phong specular highlight gliding across ocean sphere | High priority; requires ocean shader & sun uniforms |
| **Colorway Palettes** | 2 hardcoded states (Day/Night) | 4 instant presets (Night Radar, Day Sat, Cyber Cyan, Gold) | High priority; requires unified uniform structure & UI |
| **Coastline Sobel Filter**| Non-existent; binary raster test | $3 \times 3$ Sobel convolution kernel & sensitivity uniform | Medium-High; requires Sobel pass during raster scan |
| **Physics & Orbit** | Hardcoded friction & auto-spin | Dynamic damping slider, auto-orbit toggle, speed slider | Medium priority; requires physics uniform bindings |
| **Control HUD Deck** | Non-existent; single toggle button | Glassmorphic floating control deck with real-time sliders | High priority; required for R1 acceptance |
| **Lifecycle & Portability** | Leaks GPU buffers; document globals | Self-contained, zero-leak, clean props, context recovery | High priority; required for R3 & site ingestion |

---

## 5. Verification Method

To independently verify all findings and test proposals:

1. **Verify Current Build Status:**
   ```bash
   cd /Users/andrewvoirol/Antigravity/Projects/ais-terragemini
   npm run build
   ```
   *Expected:* Vite build completes without TypeScript or packaging errors.

2. **Inspect Current Shader and Buffer Implementations:**
   - View `components/RotatingEarth.tsx:31-117` to verify absence of specular/ocean uniforms.
   - View `components/RotatingEarth.tsx:428-552` to verify static point generation without density indexing or Sobel edge detection.
   - View `components/RotatingEarth.tsx:721-748` to verify per-frame `new Float32Array` allocations in render loop.

3. **Verify Dev Server Run:**
   ```bash
   npm run dev
   ```
   Inspect in browser (or Chrome DevTools) to observe rendering performance and confirm current day/night toggle limitations.
