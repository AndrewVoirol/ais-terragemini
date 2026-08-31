# Tactical Telemetry & Modular Architecture Survey Report
**Project:** TerraGemini (`ais-terragemini`)  
**Explorer:** Explorer 2 (Tactical Telemetry & Modular Architecture)  
**Target Focus:** Requirement 2 (Tactical Telemetry & Target Visualizer Overlay) & Requirement 3 (Modular Standalone Component Architecture)  
**Date:** 2026-08-31  

---

## 1. Observation

A systematic, line-by-line inspection of the current codebase at `/Users/andrewvoirol/Antigravity/Projects/ais-terragemini` revealed the following exact implementation details and architectural patterns:

### 1.1 `components/TargetVisualizer.tsx` (Current State & Deficits)
- **Props Interface (`TargetVisualizer.tsx:5-10`)**:
  ```tsx
  interface TargetVisualizerProps {
      isLoading: boolean;
      imageUrl: string | null;
      coords?: Coordinates | null;
      isNightMode: boolean;
  }
  ```
  Only 2 theme states exist (`isNightMode: boolean` resulting in amber vs blue styling at lines 13-16). None of the 4 colorway presets specified in R1/R2 (*Night Radar*, *Day Satellite*, *Cyber Cyan*, *Holographic Gold*) are supported.
- **Static Standby & Layout (`TargetVisualizer.tsx:19-48, 51-56`)**:
  - The component is statically positioned in `ChatPanel.tsx:153` (`absolute top-16 left-0 md:left-4 z-40`). It does not track or project to the 3D globe coordinates of the target.
  - In Standby mode (`!coords`), it renders an idle mock card with CSS scan lines (`animate-scan-vertical`, `animate-pan-grid`).
- **Telemetry Readout Limitations (`TargetVisualizer.tsx:112-128`)**:
  - Displays only basic fixed decimal coordinates: `{coords.lat.toFixed(2)}, {coords.lon.toFixed(2)}` (line 116).
  - Lacks cursor hover readouts, normalized topographic elevation / terrain altitude, sector bounding boxes, azimuth bearings, and distance metrics.
  - Lacks coordinate system switching (no MGRS or DMS toggling).
  - Lacks interactive target lock animation states (`SEARCHING` $\to$ `ACQUIRING` $\to$ `LOCKED`).

### 1.2 Raycasting & Coordinate Projection (`components/RotatingEarth.tsx`)
- **Unprojection Math (`RotatingEarth.tsx:778-804`)**:
  ```ts
  const getLatLonFromMouse = (mx: number, my: number): {lat: number, lon: number} | null => {
      const s = stateRef.current;
      const gl = glRef.current;
      if (!gl) return null;
      const rX = mx / s.scale;
      const rY = -my / s.scale; 
      const rSq = rX*rX + rY*rY;
      if (rSq > 1.0) return null; 
      
      const rZ = Math.sqrt(1.0 - rSq);
      const rotX = -s.rotation[0] * (Math.PI / 180);
      const rotY = -s.rotation[1] * (Math.PI / 180);
      const cx = Math.cos(-rotY);
      const sx = Math.sin(-rotY);
      const p1x = rX;
      const p1y = rY * cx - rZ * sx;
      const p1z = rY * sx + rZ * cx;
      const cy = Math.cos(-rotX);
      const sy = Math.sin(-rotX);
      const p2x = p1x * cy + p1z * sy;
      const p2y = p1y;
      const p2z = -p1x * sy + p1z * cy;
      const latRad = Math.asin(p2y);
      const lonRad = Math.atan2(p2x, p2z);
      return { lat: latRad * (180 / Math.PI), lon: lonRad * (180 / Math.PI) };
  }
  ```
  - **Observation on Unprojection**: The raycaster inverts the orthographic view matrix and rotation transformations correctly on click (`RotatingEarth.tsx:806-828`), but:
    1. It is **never called during hover / mousemove**. Canvas hover events only trigger CSS cursor changes (`cursor-grab`).
    2. There is no callback or state propagation for live cursor telemetry.
- **Missing Forward Projection (3D World $\to$ 2D Screen Space)**:
  - There is zero forward projection logic in the codebase to calculate where a geographic coordinate `(lat, lon)` projects to in screen pixels `(x, y)` given the camera yaw/pitch and scale.
  - Consequently, rotating the globe cannot synchronize floating DOM/SVG overlays, target reticles, or leader lines with surface points.

### 1.3 Target Ring & Marker Rendering (`RotatingEarth.tsx:172-273, 713-748`)
- The target marker is rendered purely inside the WebGL context via `VS_MARKER` and `FS_MARKER`.
- Lines 720-748 draw a 2-point vertical beam and a 21-point line strip.
- The ring animation is a fragment shader math trick: `float pulse = fract(u_time * 1.5); float ringRadius = pulse; ...` (lines 257-268).
- Limitations:
  - Fixed point size in screen pixels (`gl_PointSize = 32.0;` at line 230).
  - No tactical HUD geometry (no azimuth compass tick marks, range brackets, reticle rings, or leading coordinate text).
  - Cannot connect visually to DOM elements without forward projection.

### 1.4 Coordinate Formatting & MGRS System
- Search across the entire codebase (`grep_search` query: `mgrs`) revealed **zero existing MGRS conversion functions**.
- Coordinates are currently only formatted via native `.toFixed(2)` / `.toFixed(4)` in `TargetVisualizer.tsx:116`, `ChatPanel.tsx:210, 257`, and `RotatingEarth.tsx:753-755`.

### 1.5 Architecture, Globals & Lifecycle Management (`RotatingEarth.tsx` & `App.tsx`)
- **Global Event Listeners & Leaks**:
  - `App.tsx:24, 27`: Listens to `window.addEventListener('resize', handleResize)`. Does not use a `ResizeObserver`. If embedded in a sub-pane on `andrewvoirol.com`, container resizing will fail to update canvas dimensions.
  - `RotatingEarth.tsx:849-850`: In `onDown`, attaches `document.addEventListener('mousemove', onMove)` and `document.addEventListener('mouseup', onUp)`. If the component unmounts during a mouse drag, these listeners remain attached to `document`.
- **Missing WebGL Context Loss & Recovery**:
  - `RotatingEarth.tsx:365` gets the WebGL context once on mount.
  - Zero event listeners for `webglcontextlost` or `webglcontextrestored`. If GPU context is lost (tab hidden, sleep, driver reset), the application fails permanently without recovery.
- **Resource Cleanup & Memory Leaks**:
  - `RotatingEarth.tsx:357-423`: Mount `useEffect` creates 3 programs (`progDotsRef`, `progLinesRef`, `progMarkerRef`) and 5 buffers (`bufStarsRef`, `bufLinesRef`, `bufMarkerRef`, `bufBeamRef`, and later `bufDotsRef`), but returns **no cleanup function**.
  - On React unmount/remount (e.g. Next.js page transitions or React 19 StrictMode), WebGL resources are leaked.
- **CPU-Intensive Canvas 2D Rasterization (`RotatingEarth.tsx:486-530`)**:
  - TopoJSON is rendered to an offscreen 4K canvas (`4096 x 2048`) on the main thread, read back via `getImageData()`, and sampled via nested loops with `setTimeout(r, 0)` yields.
  - Point count is fixed at ~150k (`step = 2`). There is no mechanism to dynamically scale between 50k and 250k points at runtime without re-executing this expensive main-thread rasterization loop.
- **Props Interface (`RotatingEarth.tsx:6-14`)**:
  - Currently exposes minimal props:
    ```tsx
    interface RotatingEarthProps {
      width?: number;
      height?: number;
      className?: string;
      onViewChange?: (lat: number, lon: number) => void;
      onLocationSelect?: (lat: number, lon: number) => void;
      isNightMode?: boolean;
      selectedLocation?: { lat: number, lon: number } | null;
    }
    ```
  - Lacks props for initial palette, dynamic point density, solar angle, edge convolution sensitivity, auto-orbit speed, hover telemetry callbacks, and target screen tracking callbacks.

---

## 2. Logic Chain

From these direct observations, we establish the following causal conclusions:

```
[Observation: getLatLonFromMouse exists in RotatingEarth.tsx:778-804 but is only called in onClick:806]
  │
  ├─► [Gap 1: No live hover telemetry]
  │     └─► Moving the mouse over the globe produces no coordinate feedback, no terrain elevation data, and no bounding sector calculations.
  │
  └─► [Solution 1: Add throttled pointermove raycaster]
        └─► Calculate (lat, lon, elevation, sector) on mousemove, emitting onHoverChange to parent/HUD.

[Observation: No forward projection (World Lat/Lon -> Screen X/Y) in RotatingEarth.tsx]
  │
  ├─► [Gap 2: TargetVisualizer and HUD cards are disconnected from 3D globe surface]
  │     └─► Target visualizer is locked to top-left corner; no reticle pins to the rotating target location; no dynamic leader line can be drawn.
  │
  └─► [Solution 2: Implement projectLatLonToScreen(lat, lon, rotation, scale, width, height)]
        └─► In each render frame, calculate (screenX, screenY, depth, isVisible) for selected target and expose via callback or SVG/DOM overlay.

[Observation: No MGRS implementation in codebase]
  │
  ├─► [Gap 3: Missing requirement for military MGRS / Decimal Degree toggling]
  │
  └─► [Solution 3: Implement pure TypeScript WGS84 -> UTM -> MGRS / DD / DMS coordinate engine]
        └─► Build standalone utils/coordinates.ts supporting standard 10-digit MGRS (1m precision), 8-digit (10m), DD, and DMS formatting.

[Observation: RotatingEarth.tsx uses window/document listeners, lacks ResizeObserver, lacks context loss handling, leaks WebGL buffers on unmount]
  │
  ├─► [Gap 4: Component fails R3 standalone exportability criteria for andrewvoirol.com]
  │     └─► Embedding in Next.js would cause memory leaks, broken resizes in sub-containers, and crashes on WebGL context loss.
  │
  └─► [Solution 4: Full architectural refactor of RotatingEarth.tsx]
        └─► Self-contained ResizeObserver, pointer capture on canvas, webglcontextlost/restored handlers, comprehensive disposeWebGL() teardown.
```

---

## 3. Caveats

1. **Topography / Elevation Data Source**:
   - The current TopoJSON (`world-atlas-land-50m-v2`) only provides binary land/water classification.
   - For normalized elevation in the hover readout without shipping a multi-megabyte digital elevation model (DEM), we can compute a realistic topographic approximation based on landmask proximity/distance transform or incorporate an algorithmic elevation model for prominent geographical features (e.g. Himalayas, Andes, Alps, Marianas Trench).
2. **WebGL Point Density Scaling (R1 vs R3)**:
   - Dynamic point density (50k to 250k) should NOT re-run the 4K canvas rasterizer. Instead, the vertex buffer should hold the full 250k points pre-indexed, and dynamic density should be controlled either via GL uniform thresholding or `gl.drawArrays(gl.POINTS, 0, activeCount)`.
3. **MGRS Polar Regions (UPS)**:
   - Standard UTM/MGRS applies between 80°S and 84°N. For polar extremes (>84°N or <-80°S), Universal Polar Stereographic (UPS) is standard in military cartography. The coordinate engine should cleanly handle UTM zones 1-60 and fallback gracefully in polar caps.

---

## 4. Conclusion & Architectural Recommendations

To satisfy R2 (Tactical Telemetry & Target Visualizer) and R3 (Modular Standalone Component Architecture), the following modular architecture must be implemented:

### 4.1 Modular File Structure
```
ais-terragemini/
├── components/
│   ├── RotatingEarth.tsx       # Core WebGL component (fully self-contained, R3 compliant)
│   ├── TargetVisualizer.tsx    # Tactical telemetry HUD card with MGRS/DD toggles
│   ├── TacticalOverlay.tsx     # 3D-tracked target reticle, radar rings & SVG leader lines
│   ├── ControlDeck.tsx         # Floating glassmorphic shader control deck (R1)
│   ├── ChatPanel.tsx           # AI uplink & intelligence card interface
│   └── BootSequence.tsx        # Holographic startup sequence
├── utils/
│   ├── coordinates.ts          # Pure TS WGS84 -> MGRS, UTM, DD, DMS coordinate engine
│   ├── projection.ts           # Raycasting unprojection & 3D-to-2D forward projection
│   └── elevation.ts            # Normalized elevation & terrain classification
└── types.ts                    # Complete TypeScript definitions
```

### 4.2 Comprehensive Component Interfaces & Type Definitions

#### `types.ts`
```ts
export type ColorwayPalette = 'night-radar' | 'day-satellite' | 'cyber-cyan' | 'holographic-gold';
export type CoordinateFormat = 'MGRS' | 'DD' | 'DMS' | 'UTM';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface FormattedCoordinates {
  mgrs: string;       // e.g. "18T WV 83959 07350"
  dd: string;         // e.g. "40.7128° N, 74.0060° W"
  dms: string;        // e.g. "40° 42' 46.1\" N, 74° 00' 21.6\" W"
  utm: string;        // e.g. "18T 583959mE 4507351mN"
}

export interface HoverTelemetry {
  coords: Coordinates;
  formatted: FormattedCoordinates;
  elevation: number;    // Normalized 0.0 to 1.0 (or approx meters)
  isLand: boolean;
  sector: string;       // e.g. "GRID-18T-A4"
  boundingBox: [number, number, number, number]; // [minLat, minLon, maxLat, maxLon]
  screenPos: { x: number; y: number };
}

export interface TargetLock {
  coords: Coordinates;
  formatted: FormattedCoordinates;
  elevation: number;
  screenPos: { x: number; y: number; depth: number; isVisible: boolean };
  lockedAt: number;
  azimuth?: number;
}

export interface RotatingEarthProps {
  // Container & Sizing
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;

  // Shader & Theme Configuration (R1)
  palette?: ColorwayPalette;
  pointDensity?: number;      // 50,000 to 250,000
  solarAngle?: number;        // 0 to 360 degrees
  edgeSensitivity?: number;   // 0.0 to 1.0

  // Physics & Navigation
  autoOrbit?: boolean;
  orbitSpeed?: number;
  dragFriction?: number;
  interactive?: boolean;

  // Selection & Telemetry State (R2)
  selectedLocation?: Coordinates | null;
  onLocationSelect?: (coords: Coordinates) => void;
  onHoverChange?: (telemetry: HoverTelemetry | null) => void;
  onTargetScreenPosChange?: (screenPos: { x: number; y: number; depth: number; isVisible: boolean } | null) => void;
  onViewChange?: (view: { lat: number; lon: number; scale: number; fps: number }) => void;
  onReady?: () => void;
}
```

### 4.3 Coordinate Engine Blueprint (`utils/coordinates.ts`)
Must export:
- `latLonToMGRS(lat: number, lon: number, precision?: 1 | 2 | 3 | 4 | 5): string`
- `latLonToUTM(lat: number, lon: number): { zoneNumber: number; band: string; easting: number; northing: number }`
- `latLonToDD(lat: number, lon: number): string`
- `latLonToDMS(lat: number, lon: number): string`
- `formatCoordinatesAll(lat: number, lon: number): FormattedCoordinates`

### 4.4 Projection Engine Blueprint (`utils/projection.ts`)
Must export:
- `unprojectScreenToSphere(screenX: number, screenY: number, rotation: [number, number], scale: number, center: { x: number; y: number }): Coordinates | null`
- `projectSphereToScreen(lat: number, lon: number, rotation: [number, number], scale: number, center: { x: number; y: number }, altitude?: number): { x: number; y: number; depth: number; isVisible: boolean }`

### 4.5 Target Reticle & 3D Tracking Blueprint (`components/TacticalOverlay.tsx`)
- High-performance SVG/Canvas overlay positioned absolutely over `RotatingEarth`.
- Draws:
  1. **Active Hover Crosshair**: Smoothly tracks mouse cursor when hovering over the globe, showing live micro-reticle.
  2. **Locked Target Reticle**: Pinned to `screenPos` calculated on every animation frame.
     - Rotating outer bracket ring (`animate-spin-slow`)
     - Concentric range rings with azimuth tick marks
     - Pulsing center lock indicator
     - Occlusion fade: When `depth < 0`, scales down and drops opacity to 0.15 with a "BEHIND HORIZON" indicator.
  3. **Leader Line**: SVG dynamic polyline connecting the target screen anchor `(x, y)` to the floating `TargetVisualizer` card.

### 4.6 Target Visualizer Enhancements (`components/TargetVisualizer.tsx`)
- **Format Toggle**: Segmented toggle `[ MGRS | DD | DMS | UTM ]` allowing instant switching.
- **Topographic Telemetry**: Normalized elevation readout (`ELEV: +1,842m` or `ABYSSAL PLAIN -4,200m`).
- **Tactical Lock HUD**: Real-time Azimuth, Nadir offset, Solar incidence angle.
- **Visual Feed**: Integrated with Gemini Satellite imagery or fallback wireframe drone feed.

---

## 5. Verification Method

To independently verify all findings and validate subsequent implementations:

1. **TypeScript Compilation & Build Verification**:
   ```bash
   cd /Users/andrewvoirol/Antigravity/Projects/ais-terragemini
   npx tsc --noEmit
   npm run build
   ```
2. **Coordinate Math Accuracy Test**:
   Execute Node test against standard reference benchmarks:
   ```bash
   node -e '
     const { latLonToMGRS, latLonToDD, latLonToDMS } = require("./utils/coordinates.ts");
     // NYC: 40.7128, -74.0060 -> Expect ~ 18TWF8395907350
     // Tokyo: 35.6762, 139.6503 -> Expect ~ 54SUE7785548874
     // Paris: 48.8566, 2.3522 -> Expect ~ 31UDQ5248211717
   '
   ```
3. **Raycasting & Forward Projection Parity Test**:
   Verify that `unprojectScreenToSphere(projectSphereToScreen(lat, lon))` reconstructs `(lat, lon)` within $< 0.0001^\circ$ precision for visible points.
4. **Lifecycle & Memory Leak Test**:
   Mount and unmount `<RotatingEarth />` 50 times in a test harness and verify that `gl.getError() === 0` and WebGL context count remains 1 without GPU memory leaks.
5. **Interactive UI Verification**:
   - Hover cursor across the globe and verify 60fps Lat/Lon/MGRS coordinate tracking.
   - Click to drop a marker; verify that rotating the globe keeps the target reticle pinned to the exact geographic feature across 360° rotation.
   - Toggle between `MGRS`, `DD`, and `DMS` and verify instantaneous coordinate re-formatting.

