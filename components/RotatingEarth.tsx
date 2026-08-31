import React, { useEffect, useRef, useState, useCallback } from 'react';
import { geoGraticule, geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { Coordinates, ColorwayPalette, HoverTelemetry, FormattedCoordinates, RotatingEarthProps } from '../types';
import { unprojectScreenToSphere, projectSphereToScreen } from '../utils/projection';
import { formatCoordinatesAll, getSectorGridCode } from '../utils/coordinates';
import { getEstimatedElevation, classifyTerrain } from '../utils/elevation';

const DATA_SOURCES = {
  primary: {
    cacheKey: 'world-atlas-land-50m-v2',
    urls: [
      '/land-50m.json',
      'https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json',
      'https://unpkg.com/world-atlas@2.0.2/land-50m.json',
    ],
  },
};

// -----------------------------------------------------------------------------
// 4 COLORWAY PALETTE DEFINITIONS & UNIFORM PRESETS
// -----------------------------------------------------------------------------

export interface UniformColorPreset {
  landColor: [number, number, number, number];
  oceanColor: [number, number, number, number];
  specularColor: [number, number, number, number];
  gridColor: [number, number, number, number];
  atmosColor: [number, number, number, number];
  radarSweep: number;
  cssAtmos: string;
}

export const COLORWAY_PRESETS: Record<string, UniformColorPreset> = {
  night_radar: {
    landColor: [1.0, 0.16, 0.22, 0.95],
    oceanColor: [0.015, 0.02, 0.03, 0.90],
    specularColor: [1.0, 0.35, 0.35, 1.0],
    gridColor: [1.0, 0.12, 0.18, 0.09],
    atmosColor: [0.95, 0.1, 0.18, 0.28],
    radarSweep: 0.85,
    cssAtmos: 'rgba(180, 20, 35, 0.15)',
  },
  day_satellite: {
    landColor: [0.28, 0.78, 0.48, 0.95],
    oceanColor: [0.02, 0.09, 0.24, 0.92],
    specularColor: [0.98, 0.98, 0.92, 1.0],
    gridColor: [0.35, 0.65, 1.0, 0.07],
    atmosColor: [0.25, 0.55, 1.0, 0.28],
    radarSweep: 0.0,
    cssAtmos: 'rgba(30, 80, 150, 0.15)',
  },
  cyber_cyan: {
    landColor: [0.0, 0.92, 1.0, 0.95],
    oceanColor: [0.01, 0.035, 0.09, 0.90],
    specularColor: [0.45, 1.0, 1.0, 1.0],
    gridColor: [0.0, 0.85, 1.0, 0.11],
    atmosColor: [0.0, 0.8, 1.0, 0.32],
    radarSweep: 0.5,
    cssAtmos: 'rgba(0, 160, 220, 0.15)',
  },
  holographic_gold: {
    landColor: [1.0, 0.74, 0.22, 0.95],
    oceanColor: [0.03, 0.025, 0.015, 0.90],
    specularColor: [1.0, 0.92, 0.65, 1.0],
    gridColor: [1.0, 0.72, 0.22, 0.08],
    atmosColor: [1.0, 0.65, 0.18, 0.26],
    radarSweep: 0.2,
    cssAtmos: 'rgba(180, 120, 25, 0.15)',
  },
};

// Aliases for kebab-case palette names
COLORWAY_PRESETS['night-radar'] = COLORWAY_PRESETS.night_radar;
COLORWAY_PRESETS['day-satellite'] = COLORWAY_PRESETS.day_satellite;
COLORWAY_PRESETS['cyber-cyan'] = COLORWAY_PRESETS.cyber_cyan;
COLORWAY_PRESETS['holographic-gold'] = COLORWAY_PRESETS.holographic_gold;

function resolvePreset(palette?: ColorwayPalette | string, isNightMode?: boolean): UniformColorPreset {
  if (palette && COLORWAY_PRESETS[palette]) {
    return COLORWAY_PRESETS[palette];
  }
  if (isNightMode !== undefined) {
    return isNightMode ? COLORWAY_PRESETS.night_radar : COLORWAY_PRESETS.day_satellite;
  }
  return COLORWAY_PRESETS.cyber_cyan;
}

// -----------------------------------------------------------------------------
// WEBGL SHADERS
// -----------------------------------------------------------------------------

// 1. OCEAN SPHERE RAYTRACED SHADER (Blinn-Phong Specular Reflection & Limb Scattering)
const VS_OCEAN = `
attribute vec2 a_quad_pos;
uniform vec2 u_resolution;
uniform float u_scale;
uniform vec2 u_center;
varying vec2 v_sphere_uv;

void main() {
    vec2 pos = a_quad_pos * (u_scale * 1.008);
    vec2 screenPos = u_center + pos;
    vec2 ndc = (screenPos / (u_resolution * 0.5)) - vec2(1.0, 1.0);
    ndc.y = -ndc.y;
    gl_Position = vec4(ndc, 0.08, 1.0);
    v_sphere_uv = a_quad_pos * 1.008;
}
`;

const FS_OCEAN = `
precision mediump float;
uniform vec4 u_color_ocean;
uniform vec4 u_color_specular;
uniform vec4 u_color_atmos;
uniform vec3 u_sun_dir;
uniform float u_time;
uniform float u_radar_sweep;
varying vec2 v_sphere_uv;

void main() {
    float r2 = dot(v_sphere_uv, v_sphere_uv);
    if (r2 > 1.0) discard;

    float z = sqrt(max(0.0, 1.0 - r2));
    vec3 N = vec3(v_sphere_uv.x, -v_sphere_uv.y, z);
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(u_sun_dir);
    vec3 H = normalize(L + V);

    // Diffuse component
    float NdotL = max(dot(N, L), 0.0);

    // Blinn-Phong Specular highlight: (N . H)^s
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, 38.0) * step(0.001, NdotL);

    // Rayleigh / Limb scattering
    float limb = pow(1.0 - z, 2.6);

    // Dynamic tactical radar sweep effect
    float angle = atan(-v_sphere_uv.y, v_sphere_uv.x);
    float sweepAngle = mod(u_time * 1.8, 6.2831853) - 3.14159265;
    float angleDiff = mod(angle - sweepAngle + 6.2831853, 6.2831853);
    float sweep = exp(-angleDiff * 3.5) * u_radar_sweep;

    vec3 baseColor = u_color_ocean.rgb * (0.18 + 0.82 * NdotL);
    vec3 specularColor = u_color_specular.rgb * (spec * 1.85);
    vec3 atmosColor = u_color_atmos.rgb * (limb * 0.75 + sweep * 0.35);

    vec3 finalColor = baseColor + specularColor + atmosColor;
    float edgeAlpha = smoothstep(1.0, 0.985, sqrt(r2));
    float alpha = u_color_ocean.a * edgeAlpha;

    gl_FragColor = vec4(finalColor, alpha);
}
`;

// 2. LAND POINT CLOUD SHADER (Sobel Edge Sensitivity & Dynamic Scaling)
const VS_DOTS = `
precision mediump float;
attribute vec2 a_pos;
attribute vec2 a_attribs; // x: edge_strength [0..1], y: rank [0..1]
uniform vec2 u_rotation; 
uniform float u_scale;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_point_size;
uniform float u_time;
uniform float u_edge_sensitivity;
uniform vec3 u_sun_dir;

varying float v_intensity;
varying float v_edge_factor;
varying float v_z;
varying float v_sun_light;

const float PI = 3.14159265359;
const float DEG2RAD = PI / 180.0;

mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 rotateX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

void main() {
    float lon = a_pos.x * DEG2RAD;
    float lat = a_pos.y * DEG2RAD;
    
    // 3D Position on Unit Sphere
    float clat = cos(lat);
    vec3 p = vec3(clat * sin(lon), sin(lat), clat * cos(lon));
    
    // Apply Rotation
    vec3 rotated = rotateY(u_rotation.x * DEG2RAD) * p;
    rotated = rotateX(u_rotation.y * DEG2RAD) * rotated;
    
    v_z = rotated.z;

    // Culling - move hidden points to infinity
    if (rotated.z < 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }
    
    // Projection to screen
    vec2 screenPos = u_center + vec2(rotated.x, -rotated.y) * u_scale;
    vec2 ndc = (screenPos / (u_resolution * 0.5)) - vec2(1.0, 1.0);
    ndc.y = -ndc.y;
    
    gl_Position = vec4(ndc, 0.0, 1.0);
    
    // Curvature Fresnel fade
    float fresnel = smoothstep(0.0, 0.28, rotated.z);
    
    // Sobel edge sensitivity amplification
    float edgeThreshold = 1.0 - (u_edge_sensitivity * 0.85 + 0.08);
    float edgeFactor = smoothstep(edgeThreshold, 1.0, a_attribs.x);
    v_edge_factor = edgeFactor;

    // Solar illumination on topography
    vec3 L = normalize(u_sun_dir);
    float NdotL = max(dot(rotated, L), 0.0);
    v_sun_light = 0.35 + 0.65 * NdotL;
    
    // Point size calculation
    float baseSize = u_point_size;
    float edgeSizeBoost = 1.0 + edgeFactor * 1.6 * u_edge_sensitivity;
    float pulse = 1.0 + sin(u_time * 2.0 + p.x * 8.0) * 0.06;
    
    gl_PointSize = clamp(baseSize * fresnel * edgeSizeBoost * pulse * (1.0 + rotated.z * 0.25), 1.0, 64.0);
    
    v_intensity = fresnel;
}
`;

const FS_DOTS = `
precision mediump float;
uniform vec4 u_color;
uniform vec4 u_color_specular;
uniform float u_edge_sensitivity;
varying float v_intensity;
varying float v_edge_factor;
varying float v_sun_light;

void main() {
    // Circular smooth dot
    vec2 coord = gl_PointCoord * 2.0 - 1.0;
    float dist = length(coord);
    if (dist > 1.0) discard;
    
    // High quality anti-aliasing
    float alpha = 1.0 - smoothstep(0.75, 1.0, dist);
    
    // Mix color based on intensity, edge factor and solar illumination
    vec3 baseColor = u_color.rgb * v_sun_light;
    vec3 edgeBoost = mix(baseColor, u_color_specular.rgb, v_edge_factor * u_edge_sensitivity * 0.75);
    
    gl_FragColor = vec4(edgeBoost, u_color.a * alpha * v_intensity * (1.0 + v_edge_factor * 0.35));
}
`;

// 3. GRATICULE LINES SHADER
const VS_LINES = `
attribute vec2 a_pos;
uniform vec2 u_rotation;
uniform float u_scale;
uniform vec2 u_resolution;
uniform vec2 u_center;

varying float v_z;
const float PI = 3.14159265359;
const float DEG2RAD = PI / 180.0;

mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 rotateX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

void main() {
    float lon = a_pos.x * DEG2RAD;
    float lat = a_pos.y * DEG2RAD;
    float clat = cos(lat);
    vec3 p = vec3(clat * sin(lon), sin(lat), clat * cos(lon));
    
    vec3 rotated = rotateY(u_rotation.x * DEG2RAD) * p;
    rotated = rotateX(u_rotation.y * DEG2RAD) * rotated;
    v_z = rotated.z;
    
    vec2 screenPos = u_center + vec2(rotated.x, -rotated.y) * u_scale;
    vec2 ndc = (screenPos / (u_resolution * 0.5)) - vec2(1.0, 1.0);
    ndc.y = -ndc.y;
    
    gl_Position = vec4(ndc, 0.01, 1.0);
}
`;

const FS_LINES = `
precision mediump float;
uniform vec4 u_color;
varying float v_z;

void main() {
    if (v_z < 0.0) discard;
    float alpha = smoothstep(0.0, 0.18, v_z);
    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;

// 4. SELECTION MARKER & BEAM SHADER
const VS_MARKER = `
precision mediump float;
attribute vec2 a_pos;
attribute float a_offset;
uniform vec2 u_rotation;
uniform float u_scale;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_time;

varying float v_z;
varying float v_offset;

const float PI = 3.14159265359;
const float DEG2RAD = PI / 180.0;

mat3 rotateY(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 rotateX(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

void main() {
    float lon = a_pos.x * DEG2RAD;
    float lat = a_pos.y * DEG2RAD;
    
    float clat = cos(lat);
    vec3 p = vec3(clat * sin(lon), sin(lat), clat * cos(lon));
    
    float height = 1.0 + (a_offset * 0.35); 
    p *= height;

    vec3 rotated = rotateY(u_rotation.x * DEG2RAD) * p;
    rotated = rotateX(u_rotation.y * DEG2RAD) * rotated;
    
    v_z = rotated.z;
    v_offset = a_offset;
    
    if (rotated.z < -0.2) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }
    
    vec2 screenPos = u_center + vec2(rotated.x, -rotated.y) * u_scale;
    vec2 ndc = (screenPos / (u_resolution * 0.5)) - vec2(1.0, 1.0);
    ndc.y = -ndc.y;
    
    gl_Position = vec4(ndc, 0.0, 1.0);
    
    if (a_offset > 0.9) {
       gl_PointSize = 28.0; 
    } else {
       gl_PointSize = 14.0;
    }
}
`;

const FS_MARKER = `
precision mediump float;
uniform float u_time;
uniform vec4 u_color;
varying float v_offset;

void main() {
    vec2 coord = gl_PointCoord * 2.0 - 1.0;
    float dist = length(coord);
    if (dist > 1.0) discard;
    
    float alpha = 0.0;
    
    if (v_offset > 0.9) {
        float glow = max(0.0, 1.0 - dist);
        glow = pow(glow, 2.0);
        alpha = glow;
    } else {
        float pulse = fract(u_time * 1.5);
        float ringRadius = pulse;
        float width = 0.2 * (1.0 - pulse);
        float d = abs(dist - ringRadius) - width;
        
        if (d < 0.0) {
            alpha = (1.0 - pulse) * 0.85; 
        } else {
            if (dist < 0.35) alpha = 1.0;
        }
    }
    
    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;

// Helper: 3x3 Sobel Gradient Computation
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

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export default function RotatingEarth({
  width = 800,
  height = 600,
  className = '',
  style,
  palette,
  pointDensity = 150000,
  solarAngle = 45,
  edgeSensitivity = 0.5,
  autoOrbit = true,
  orbitSpeed = 0.8,
  dragFriction = 0.96,
  interactive = true,
  selectedLocation = null,
  onLocationSelect,
  onHoverChange,
  onTargetScreenPosChange,
  onViewChange,
  onReady,
  isNightMode,
}: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Persistent WebGL Context & Resource References
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const progOceanRef = useRef<WebGLProgram | null>(null);
  const progDotsRef = useRef<WebGLProgram | null>(null);
  const progLinesRef = useRef<WebGLProgram | null>(null);
  const progMarkerRef = useRef<WebGLProgram | null>(null);

  const bufOceanRef = useRef<WebGLBuffer | null>(null);
  const bufDotsRef = useRef<WebGLBuffer | null>(null);
  const bufLinesRef = useRef<WebGLBuffer | null>(null);
  const bufStarsRef = useRef<WebGLBuffer | null>(null);
  const bufMarkerRef = useRef<WebGLBuffer | null>(null);
  const bufBeamRef = useRef<WebGLBuffer | null>(null);

  const countsRef = useRef({ dots: 0, lines: 0, stars: 0, totalGeneratedDots: 0 });
  const isLoadedRef = useRef(false);

  // Pre-allocated static arrays for marker & beam (zero per-frame GC allocations)
  const markerDataRef = useRef(new Float32Array([0, 0, 0.0, 0, 0, 1.0]));
  const beamDataRef = useRef(new Float32Array(21 * 3));

  // Current smooth uniform state
  const initialPreset = resolvePreset(palette, isNightMode);
  const uniformsStateRef = useRef<{
    landColor: [number, number, number, number];
    oceanColor: [number, number, number, number];
    specularColor: [number, number, number, number];
    gridColor: [number, number, number, number];
    atmosColor: [number, number, number, number];
    radarSweep: number;
    solarAngle: number;
    edgeSensitivity: number;
  }>({
    landColor: [...initialPreset.landColor],
    oceanColor: [...initialPreset.oceanColor],
    specularColor: [...initialPreset.specularColor],
    gridColor: [...initialPreset.gridColor],
    atmosColor: [...initialPreset.atmosColor],
    radarSweep: initialPreset.radarSweep,
    solarAngle,
    edgeSensitivity,
  });

  // State ref for physics and render loop
  const stateRef = useRef({
    rotation: [0, -20] as [number, number],
    velocity: [0.5, 0] as [number, number],
    scale: 0,
    targetScale: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 },
    hasMoved: false,
    time: 0,
    selectedLocation: null as Coordinates | null,
    flyToTarget: null as { lat: number; lon: number; startTime: number; startRot: [number, number] } | null,
    width: width || 800,
    height: height || 600,
  });

  // Prop refs to prevent stale closures inside requestAnimationFrame
  const propsRef = useRef({
    palette,
    pointDensity,
    solarAngle,
    edgeSensitivity,
    autoOrbit,
    orbitSpeed,
    dragFriction,
    interactive,
    isNightMode,
  });

  useEffect(() => {
    propsRef.current = {
      palette,
      pointDensity,
      solarAngle,
      edgeSensitivity,
      autoOrbit,
      orbitSpeed,
      dragFriction,
      interactive,
      isNightMode,
    };
  }, [palette, pointDensity, solarAngle, edgeSensitivity, autoOrbit, orbitSpeed, dragFriction, interactive, isNightMode]);

  // Callback refs
  const onLocationSelectRef = useRef(onLocationSelect);
  const onHoverChangeRef = useRef(onHoverChange);
  const onTargetScreenPosChangeRef = useRef(onTargetScreenPosChange);
  const onViewChangeRef = useRef(onViewChange);
  const onReadyRef = useRef(onReady);

  useEffect(() => { onLocationSelectRef.current = onLocationSelect; }, [onLocationSelect]);
  useEffect(() => { onHoverChangeRef.current = onHoverChange; }, [onHoverChange]);
  useEffect(() => { onTargetScreenPosChangeRef.current = onTargetScreenPosChange; }, [onTargetScreenPosChange]);
  useEffect(() => { onViewChangeRef.current = onViewChange; }, [onViewChange]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

  // Sync selectedLocation prop
  useEffect(() => {
    if (selectedLocation) {
      const s = stateRef.current;
      const isSame =
        s.selectedLocation &&
        Math.abs(s.selectedLocation.lat - selectedLocation.lat) < 0.001 &&
        Math.abs(s.selectedLocation.lon - selectedLocation.lon) < 0.001;

      if (!isSame) {
        s.selectedLocation = selectedLocation;
        s.flyToTarget = {
          lat: selectedLocation.lat,
          lon: selectedLocation.lon,
          startTime: performance.now(),
          startRot: [...s.rotation],
        };
      }
    } else if (selectedLocation === null) {
      stateRef.current.selectedLocation = null;
    }
  }, [selectedLocation]);

  // React State for UI
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing Planetary System...');
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState({ fps: 0, lat: 0, lon: 0, alt: 0 });
  const [atmosColor, setAtmosColor] = useState(initialPreset.cssAtmos);

  // ---------------------------------------------------------------------------
  // 1. WEBGL SETUP & SHADER COMPILATION
  // ---------------------------------------------------------------------------
  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const effectiveWidth = stateRef.current.width || 800;
    const effectiveHeight = stateRef.current.height || 600;
    stateRef.current.scale = Math.min(effectiveWidth, effectiveHeight) / 2.4;
    stateRef.current.targetScale = stateRef.current.scale;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
    if (!gl) {
      setError('WebGL Failed');
      return;
    }
    glRef.current = gl;

    const compile = (vsSrc: string, fsSrc: string): WebGLProgram | null => {
      const createS = (type: number, src: string) => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.error(gl.getShaderInfoLog(s));
          return null;
        }
        return s;
      };
      const v = createS(gl.VERTEX_SHADER, vsSrc);
      const f = createS(gl.FRAGMENT_SHADER, fsSrc);
      if (!v || !f) return null;
      const p = gl.createProgram();
      if (!p) return null;
      gl.attachShader(p, v);
      gl.attachShader(p, f);
      gl.linkProgram(p);
      return p;
    };

    progOceanRef.current = compile(VS_OCEAN, FS_OCEAN);
    progDotsRef.current = compile(VS_DOTS, FS_DOTS);
    progLinesRef.current = compile(VS_LINES, FS_LINES);
    progMarkerRef.current = compile(VS_MARKER, FS_MARKER);

    // Ocean Billboard Quad [-1..1]
    const oceanQuad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const ob = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ob);
    gl.bufferData(gl.ARRAY_BUFFER, oceanQuad, gl.STATIC_DRAW);
    bufOceanRef.current = ob;

    // Stars Background (2,000 points)
    const starCount = 2000;
    const stars = new Float32Array(starCount * 2);
    for (let i = 0; i < starCount; i++) {
      stars[i * 2] = Math.random() * 360 - 180;
      stars[i * 2 + 1] = (Math.random() - 0.5) * 180;
    }
    const sb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, stars, gl.STATIC_DRAW);
    bufStarsRef.current = sb;
    countsRef.current.stars = starCount;

    // Graticule Lines (10 degree step)
    const graticule = geoGraticule().step([10, 10])();
    const lineCoords: number[] = [];
    // @ts-ignore
    graticule.coordinates.forEach((line: number[][]) => {
      for (let i = 0; i < line.length - 1; i++) {
        lineCoords.push(line[i][0], line[i][1]);
        lineCoords.push(line[i + 1][0], line[i + 1][1]);
      }
    });
    const lb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineCoords), gl.STATIC_DRAW);
    bufLinesRef.current = lb;
    countsRef.current.lines = lineCoords.length / 2;

    // Selection Marker & Beam Buffers
    const mb = gl.createBuffer();
    bufMarkerRef.current = mb;

    const bb = gl.createBuffer();
    bufBeamRef.current = bb;
  }, []);

  useEffect(() => {
    initWebGL();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL context lost');
    };

    const handleContextRestored = () => {
      console.info('WebGL context restored, re-initializing pipeline');
      initWebGL();
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      // Clean WebGL resource disposal (Zero memory leaks)
      const gl = glRef.current;
      if (gl) {
        if (progOceanRef.current) gl.deleteProgram(progOceanRef.current);
        if (progDotsRef.current) gl.deleteProgram(progDotsRef.current);
        if (progLinesRef.current) gl.deleteProgram(progLinesRef.current);
        if (progMarkerRef.current) gl.deleteProgram(progMarkerRef.current);

        if (bufOceanRef.current) gl.deleteBuffer(bufOceanRef.current);
        if (bufDotsRef.current) gl.deleteBuffer(bufDotsRef.current);
        if (bufLinesRef.current) gl.deleteBuffer(bufLinesRef.current);
        if (bufStarsRef.current) gl.deleteBuffer(bufStarsRef.current);
        if (bufMarkerRef.current) gl.deleteBuffer(bufMarkerRef.current);
        if (bufBeamRef.current) gl.deleteBuffer(bufBeamRef.current);
      }
    };
  }, [initWebGL]);

  // ---------------------------------------------------------------------------
  // 2. DATA LOADING & 250,000 PRE-RANKED POINT GENERATION (WITH 3X3 SOBEL KERNEL)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isLoadedRef.current) {
      setLoadingProgress(100);
      return;
    }

    const controller = new AbortController();

    const fetchTopology = async (): Promise<Topology> => {
      const { cacheKey, urls } = DATA_SOURCES.primary;

      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          const cache = await caches.open('terragemini-maps-v1');
          const cachedRes = await cache.match(cacheKey);
          if (cachedRes) {
            return await cachedRes.json();
          }
        } catch (e) {
          console.warn('Cache access error', e);
        }
      }

      for (const url of urls) {
        if (controller.signal.aborted) throw new Error('Aborted');
        try {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          if (typeof window !== 'undefined' && 'caches' in window) {
            try {
              const cache = await caches.open('terragemini-maps-v1');
              await cache.put(cacheKey, res.clone());
            } catch (e) {
              console.warn('Cache write failed', e);
            }
          }
          return await res.json();
        } catch {
          console.warn(`Failed to load from ${url}, trying next...`);
        }
      }
      throw new Error('All data sources failed');
    };

    const loadPoints = async () => {
      try {
        setLoadingText('Downloading Global Topography...');
        setLoadingProgress(15);

        const topo = await fetchTopology();
        setLoadingProgress(35);
        setLoadingText('Rasterizing 4K Geographic Matrix...');

        const size = 4096;
        const width = size;
        const height = size / 2;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context error');

        const land = feature(topo, (topo.objects.land || topo.objects.countries) as GeometryCollection);
        const projection = geoEquirectangular().fitSize([width, height], land);
        const path = geoPath(projection, ctx);

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        path(land);
        ctx.fill();

        setLoadingProgress(55);
        setLoadingText('Applying 3x3 Sobel Coastline Convolution...');

        const imgData = ctx.getImageData(0, 0, width, height).data;

        interface PointCandidate {
          lon: number;
          lat: number;
          edgeStrength: number;
          rank: number;
        }

        const candidates: PointCandidate[] = [];
        const step = 2;

        for (let y = 0; y < height; y += step) {
          if (controller.signal.aborted) return;
          const xOff = (y / step) % 2 === 0 ? 0 : Math.floor(step / 2);

          for (let x = xOff; x < width; x += step) {
            const i = (y * width + x) * 4;
            if (imgData[i] > 100) {
              const lat = 90 - (y / height) * 180;
              // Cosine Rejection Sampling for uniform spherical distribution
              if (Math.random() > Math.cos(lat * (Math.PI / 180))) continue;

              const lon = (x / width) * 360 - 180;
              const edgeStrength = computeSobelGradient(x, y, width, height, imgData);

              // Importance rank: edge points and stratified random distribution
              const rank = edgeStrength * 0.65 + Math.random() * 0.35;
              candidates.push({ lon, lat, edgeStrength, rank });
            }
          }

          if (y % 200 === 0) {
            setLoadingProgress(55 + Math.floor((y / height) * 35));
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        // Sort candidates by importance rank descending
        candidates.sort((a, b) => b.rank - a.rank);

        // Cap to maximum 250,000 points
        const targetMaxPoints = Math.min(250000, candidates.length);
        const finalPoints = candidates.slice(0, targetMaxPoints);

        // Pack into vertex buffer: [lon, lat, edge_strength, rank] (16 bytes per vertex)
        const vertexData = new Float32Array(finalPoints.length * 4);
        for (let i = 0; i < finalPoints.length; i++) {
          const pt = finalPoints[i];
          vertexData[i * 4 + 0] = pt.lon;
          vertexData[i * 4 + 1] = pt.lat;
          vertexData[i * 4 + 2] = pt.edgeStrength;
          vertexData[i * 4 + 3] = pt.rank;
        }

        const gl = glRef.current;
        if (gl && !controller.signal.aborted) {
          const b = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, b);
          gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
          bufDotsRef.current = b;
          countsRef.current.dots = finalPoints.length;
          countsRef.current.totalGeneratedDots = finalPoints.length;
          isLoadedRef.current = true;
          setLoadingProgress(100);

          if (onReadyRef.current) {
            onReadyRef.current();
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError' && e.message !== 'Aborted') {
          console.error(e);
          setError('Map Load Error');
        }
      }
    };

    loadPoints();
    return () => controller.abort();
  }, []);

  // ---------------------------------------------------------------------------
  // 3. RENDER LOOP, UNIFORM LERPING & PHYSICS INTEGRATION
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (loadingProgress < 100) return;

    let animId = 0;
    let lastT = performance.now();
    let frame = 0;
    let fpsT = lastT;
    let currentFps = 60;

    const render = (now: number) => {
      const dt = Math.min(now - lastT, 50);
      lastT = now;
      const gl = glRef.current;
      const s = stateRef.current;

      if (!gl) return;

      const p = propsRef.current;
      const targetPreset = resolvePreset(p.palette, p.isNightMode);
      const u = uniformsStateRef.current;

      // --- SMOOTH UNIFORM VECTOR LERPING (Zero Recompilation Hitching) ---
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

      // Compute 3D Solar Direction Vector
      const sunRad = (u.solarAngle * Math.PI) / 180.0;
      const sunDir: [number, number, number] = [Math.cos(sunRad), 0.35, Math.sin(sunRad)];
      const sunLen = Math.sqrt(sunDir[0] * sunDir[0] + sunDir[1] * sunDir[1] + sunDir[2] * sunDir[2]);
      const normSunDir: [number, number, number] = [sunDir[0] / sunLen, sunDir[1] / sunLen, sunDir[2] / sunLen];

      // --- PHYSICS & MOMENTUM ---
      s.time += dt * 0.001;

      // 1. Zoom Spring
      s.scale += (s.targetScale - s.scale) * 0.1;

      // 2. Fly To Animation
      if (s.flyToTarget) {
        const duration = 1400;
        const elapsed = now - s.flyToTarget.startTime;
        const progress = Math.min(1.0, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 3);

        const targetRotX = -s.flyToTarget.lon;
        const targetRotY = -s.flyToTarget.lat;

        let startX = s.flyToTarget.startRot[0];
        let diffX = targetRotX - startX;
        while (diffX > 180) diffX -= 360;
        while (diffX < -180) diffX += 360;

        s.rotation[0] = startX + diffX * ease;
        s.rotation[1] = s.flyToTarget.startRot[1] + (targetRotY - s.flyToTarget.startRot[1]) * ease;

        if (progress >= 1.0) {
          s.flyToTarget = null;
          s.velocity = [0, 0];
        }
      }
      // 3. Inertia & Auto-Orbit
      else if (!s.isDragging) {
        const friction = p.dragFriction ?? 0.96;
        s.velocity[0] *= friction;
        s.velocity[1] *= friction;

        const autoOrbitEnabled = p.autoOrbit ?? true;
        const orbitSpd = p.orbitSpeed ?? 0.8;

        if (autoOrbitEnabled && !s.selectedLocation) {
          if (Math.abs(s.velocity[0]) < 0.25 && Math.abs(s.velocity[1]) < 0.01) {
            s.velocity[0] += (orbitSpd - s.velocity[0]) * 0.015;
          }
        } else if (s.selectedLocation) {
          if (Math.abs(s.velocity[0]) < 0.01) s.velocity[0] = 0;
          if (Math.abs(s.velocity[1]) < 0.01) s.velocity[1] = 0;
        }

        s.rotation[0] += s.velocity[0];
        s.rotation[1] += s.velocity[1];
        s.rotation[1] = Math.max(-85, Math.min(85, s.rotation[1]));
      }

      // --- RESIZE & RESOLUTION ---
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
      const dw = Math.floor(s.width * dpr);
      const dh = Math.floor(s.height * dpr);
      const canvas = canvasRef.current;
      if (canvas && (canvas.width !== dw || canvas.height !== dh)) {
        canvas.width = dw;
        canvas.height = dh;
        gl.viewport(0, 0, dw, dh);
      }

      const centerScreen: [number, number] = [dw * 0.5, dh * 0.5];

      // --- WEBGL DRAW PASS ---
      gl.clearColor(0.015, 0.015, 0.02, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Helper for setting standard uniforms
      const setStandardUniforms = (prog: WebGLProgram) => {
        gl.useProgram(prog);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_rotation'), s.rotation[0], s.rotation[1]);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_scale'), s.scale * dpr);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), dw, dh);
        gl.uniform2f(gl.getUniformLocation(prog, 'u_center'), centerScreen[0], centerScreen[1]);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_time'), s.time);
        gl.uniform3f(gl.getUniformLocation(prog, 'u_sun_dir'), normSunDir[0], normSunDir[1], normSunDir[2]);
      };

      // 1. Stars (Deep Background)
      if (bufStarsRef.current && progDotsRef.current) {
        setStandardUniforms(progDotsRef.current);
        const aPos = gl.getAttribLocation(progDotsRef.current, 'a_pos');
        const aAttribs = gl.getAttribLocation(progDotsRef.current, 'a_attribs');

        gl.bindBuffer(gl.ARRAY_BUFFER, bufStarsRef.current);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        if (aAttribs !== -1) {
          gl.disableVertexAttribArray(aAttribs);
          gl.vertexAttrib2f(aAttribs, 0.0, 0.0);
        }

        gl.uniform2f(gl.getUniformLocation(progDotsRef.current, 'u_rotation'), s.rotation[0] * 0.08, s.rotation[1] * 0.08);
        gl.uniform1f(gl.getUniformLocation(progDotsRef.current, 'u_scale'), s.scale * dpr * 2.8);
        gl.uniform1f(gl.getUniformLocation(progDotsRef.current, 'u_point_size'), 1.4 * dpr);
        gl.uniform1f(gl.getUniformLocation(progDotsRef.current, 'u_edge_sensitivity'), 0.0);
        gl.uniform4f(gl.getUniformLocation(progDotsRef.current, 'u_color'), 1.0, 1.0, 1.0, 0.22);
        gl.uniform4f(gl.getUniformLocation(progDotsRef.current, 'u_color_specular'), 1.0, 1.0, 1.0, 1.0);
        gl.drawArrays(gl.POINTS, 0, countsRef.current.stars);
      }

      // 2. Ocean Raytraced Sphere Mesh (Blinn-Phong Specular & Limb Scattering)
      if (bufOceanRef.current && progOceanRef.current) {
        gl.useProgram(progOceanRef.current);
        gl.uniform2f(gl.getUniformLocation(progOceanRef.current, 'u_resolution'), dw, dh);
        gl.uniform1f(gl.getUniformLocation(progOceanRef.current, 'u_scale'), s.scale * dpr);
        gl.uniform2f(gl.getUniformLocation(progOceanRef.current, 'u_center'), centerScreen[0], centerScreen[1]);
        gl.uniform1f(gl.getUniformLocation(progOceanRef.current, 'u_time'), s.time);
        gl.uniform3f(gl.getUniformLocation(progOceanRef.current, 'u_sun_dir'), normSunDir[0], normSunDir[1], normSunDir[2]);
        gl.uniform4f(gl.getUniformLocation(progOceanRef.current, 'u_color_ocean'), u.oceanColor[0], u.oceanColor[1], u.oceanColor[2], u.oceanColor[3]);
        gl.uniform4f(gl.getUniformLocation(progOceanRef.current, 'u_color_specular'), u.specularColor[0], u.specularColor[1], u.specularColor[2], u.specularColor[3]);
        gl.uniform4f(gl.getUniformLocation(progOceanRef.current, 'u_color_atmos'), u.atmosColor[0], u.atmosColor[1], u.atmosColor[2], u.atmosColor[3]);
        gl.uniform1f(gl.getUniformLocation(progOceanRef.current, 'u_radar_sweep'), u.radarSweep);

        const aQuadPos = gl.getAttribLocation(progOceanRef.current, 'a_quad_pos');
        gl.bindBuffer(gl.ARRAY_BUFFER, bufOceanRef.current);
        gl.enableVertexAttribArray(aQuadPos);
        gl.vertexAttribPointer(aQuadPos, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      // 3. Graticule Lines
      if (bufLinesRef.current && progLinesRef.current) {
        setStandardUniforms(progLinesRef.current);
        const aPos = gl.getAttribLocation(progLinesRef.current, 'a_pos');
        gl.bindBuffer(gl.ARRAY_BUFFER, bufLinesRef.current);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        gl.uniform4f(gl.getUniformLocation(progLinesRef.current, 'u_color'), u.gridColor[0], u.gridColor[1], u.gridColor[2], u.gridColor[3]);
        gl.drawArrays(gl.LINES, 0, countsRef.current.lines);
      }

      // 4. Land Dots (Dynamic Point Density & Sobel Edge Convolution)
      if (bufDotsRef.current && progDotsRef.current) {
        setStandardUniforms(progDotsRef.current);
        const aPos = gl.getAttribLocation(progDotsRef.current, 'a_pos');
        const aAttribs = gl.getAttribLocation(progDotsRef.current, 'a_attribs');

        gl.bindBuffer(gl.ARRAY_BUFFER, bufDotsRef.current);
        gl.enableVertexAttribArray(aPos);
        // Stride: 16 bytes (4 floats: lon, lat, edgeStrength, rank)
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);

        if (aAttribs !== -1) {
          gl.enableVertexAttribArray(aAttribs);
          gl.vertexAttribPointer(aAttribs, 2, gl.FLOAT, false, 16, 8);
        }

        gl.uniform1f(gl.getUniformLocation(progDotsRef.current, 'u_point_size'), 1.85 * dpr);
        gl.uniform1f(gl.getUniformLocation(progDotsRef.current, 'u_edge_sensitivity'), u.edgeSensitivity);
        gl.uniform4f(gl.getUniformLocation(progDotsRef.current, 'u_color'), u.landColor[0], u.landColor[1], u.landColor[2], u.landColor[3]);
        gl.uniform4f(gl.getUniformLocation(progDotsRef.current, 'u_color_specular'), u.specularColor[0], u.specularColor[1], u.specularColor[2], u.specularColor[3]);

        // Dynamic Point Cloud Density (50,000 to 250,000 points without CPU re-rasterization)
        const densityTarget = p.pointDensity ?? 150000;
        const activeCount = Math.max(50000, Math.min(250000, Math.round(densityTarget)));
        const renderPoints = Math.min(activeCount, countsRef.current.dots);

        gl.drawArrays(gl.POINTS, 0, renderPoints);
      }

      // 5. Selection Marker & Beam Line
      if (s.selectedLocation && bufMarkerRef.current && progMarkerRef.current) {
        setStandardUniforms(progMarkerRef.current);
        const aPos = gl.getAttribLocation(progMarkerRef.current, 'a_pos');
        const aOffset = gl.getAttribLocation(progMarkerRef.current, 'a_offset');

        gl.uniform4f(gl.getUniformLocation(progMarkerRef.current, 'u_color'), u.specularColor[0], u.specularColor[1], u.specularColor[2], 1.0);

        // Update pre-allocated marker vertex array
        const mData = markerDataRef.current;
        mData[0] = s.selectedLocation.lon;
        mData[1] = s.selectedLocation.lat;
        mData[2] = 0.0;
        mData[3] = s.selectedLocation.lon;
        mData[4] = s.selectedLocation.lat;
        mData[5] = 1.0;

        gl.bindBuffer(gl.ARRAY_BUFFER, bufMarkerRef.current);
        gl.bufferData(gl.ARRAY_BUFFER, mData, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 12, 0);
        if (aOffset !== -1) {
          gl.enableVertexAttribArray(aOffset);
          gl.vertexAttribPointer(aOffset, 1, gl.FLOAT, false, 12, 8);
        }
        gl.drawArrays(gl.POINTS, 0, 2);

        // Update pre-allocated beam line vertex array
        const bData = beamDataRef.current;
        for (let i = 0; i <= 20; i++) {
          bData[i * 3 + 0] = s.selectedLocation.lon;
          bData[i * 3 + 1] = s.selectedLocation.lat;
          bData[i * 3 + 2] = i / 20.0;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, bufBeamRef.current);
        gl.bufferData(gl.ARRAY_BUFFER, bData, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 12, 0);
        if (aOffset !== -1) gl.vertexAttribPointer(aOffset, 1, gl.FLOAT, false, 12, 8);
        gl.drawArrays(gl.POINTS, 0, 21);
      }

      // Forward target tracking callback
      if (s.selectedLocation && onTargetScreenPosChangeRef.current) {
        const screenPos = projectSphereToScreen(
          s.selectedLocation.lat,
          s.selectedLocation.lon,
          s.rotation,
          s.scale,
          { x: s.width * 0.5, y: s.height * 0.5 }
        );
        onTargetScreenPosChangeRef.current(screenPos);
      } else if (!s.selectedLocation && onTargetScreenPosChangeRef.current) {
        onTargetScreenPosChangeRef.current(null);
      }

      // Telemetry update & View Change callback
      frame++;
      if (now - fpsT >= 500) {
        const lat = Math.round(-s.rotation[1]);
        const lon = Math.round((((-s.rotation[0] % 360) + 360) % 360));
        const alt = Math.round((2000 / s.scale) * 100);
        currentFps = Math.round((frame * 1000) / (now - fpsT));

        setTelemetry({ fps: currentFps, lat, lon, alt });
        setAtmosColor(targetPreset.cssAtmos);

        frame = 0;
        fpsT = now;

        if (onViewChangeRef.current) {
          const nLon = (((-s.rotation[0] % 360) + 540) % 360) - 180;
          if (typeof onViewChangeRef.current === 'function') {
            if (onViewChangeRef.current.length >= 2) {
              (onViewChangeRef.current as any)(lat, nLon);
            } else {
              (onViewChangeRef.current as any)({ lat, lon: nLon, scale: s.scale, fps: currentFps });
            }
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [loadingProgress]);

  // ---------------------------------------------------------------------------
  // 4. RESIZE OBSERVER & CONTAINER DIMENSION ADAPTATION
  // ---------------------------------------------------------------------------
  useEffect(() => {
    stateRef.current.width = width || 800;
    stateRef.current.height = height || 600;

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          stateRef.current.width = w;
          stateRef.current.height = h;
          if (stateRef.current.scale === 0) {
            stateRef.current.scale = Math.min(w, h) / 2.4;
            stateRef.current.targetScale = stateRef.current.scale;
          }
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [width, height]);

  // ---------------------------------------------------------------------------
  // 5. POINTER EVENTS & INTERACTION (ELIMINATING DOCUMENT GLOBALS)
  // ---------------------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!propsRef.current.interactive) return;
    const s = stateRef.current;
    s.isDragging = true;
    s.hasMoved = false;
    s.dragStart = { x: e.clientX, y: e.clientY };
    s.velocity = [0, 0];
    s.flyToTarget = null;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const center = { x: rect.width * 0.5, y: rect.height * 0.5 };

    // Active drag rotation
    if (s.isDragging && propsRef.current.interactive) {
      const dx = e.clientX - s.dragStart.x;
      const dy = e.clientY - s.dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        s.hasMoved = true;
      }
      s.dragStart = { x: e.clientX, y: e.clientY };
      s.rotation[0] += dx * 0.4;
      s.rotation[1] -= dy * 0.4;
      s.rotation[1] = Math.max(-85, Math.min(85, s.rotation[1]));
      s.velocity = [dx * 0.4, -dy * 0.4];
    }

    // Continuous hover raycasting telemetry
    if (onHoverChangeRef.current) {
      const hitCoords = unprojectScreenToSphere(screenX, screenY, s.rotation, s.scale, center);

      if (hitCoords) {
        const formatted: FormattedCoordinates = formatCoordinatesAll(hitCoords.lat, hitCoords.lon);
        const elevData = getEstimatedElevation(hitCoords.lat, hitCoords.lon);
        const terrainType = classifyTerrain(hitCoords.lat, hitCoords.lon, elevData.elevationMeters);
        const sectorCode = getSectorGridCode(hitCoords.lat, hitCoords.lon);
        const screenPos = projectSphereToScreen(hitCoords.lat, hitCoords.lon, s.rotation, s.scale, center);

        const hoverTelemetry: HoverTelemetry = {
          coords: hitCoords,
          formatted,
          elevationMeters: elevData.elevationMeters,
          normalizedElevation: elevData.normalizedElevation,
          terrainType,
          sectorCode,
          screenPos,
        };
        onHoverChangeRef.current(hoverTelemetry);
      } else {
        onHoverChangeRef.current(null);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current;
    if (s.isDragging) {
      s.isDragging = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }

      // Check if this was a click (no significant drag movement)
      if (!s.hasMoved && propsRef.current.interactive) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          const center = { x: rect.width * 0.5, y: rect.height * 0.5 };
          const result = unprojectScreenToSphere(screenX, screenY, s.rotation, s.scale, center);

          if (result) {
            s.selectedLocation = result;
            s.flyToTarget = {
              lat: result.lat,
              lon: result.lon,
              startTime: performance.now(),
              startRot: [...s.rotation],
            };

            if (onLocationSelectRef.current) {
              if (onLocationSelectRef.current.length >= 2) {
                (onLocationSelectRef.current as any)(result.lat, result.lon);
              } else {
                (onLocationSelectRef.current as any)(result);
              }
            }
          }
        }
      }
    }
  };

  const handlePointerLeave = () => {
    if (onHoverChangeRef.current) {
      onHoverChangeRef.current(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!propsRef.current.interactive) return;
    const s = stateRef.current;
    const dir = e.deltaY > 0 ? -1 : 1;
    const multiplier = 1 + 0.15 * Math.abs(dir);

    if (dir > 0) s.targetScale *= multiplier;
    else s.targetScale /= multiplier;

    const currentW = s.width || 800;
    const currentH = s.height || 600;
    const minScale = Math.min(currentW, currentH) / 5.0;
    const maxScale = Math.min(currentW, currentH) * 3.5;
    s.targetScale = Math.max(minScale, Math.min(maxScale, s.targetScale));
  };

  if (error) {
    return <div className="flex h-full items-center justify-center text-red-500 font-mono text-xs">{error}</div>;
  }

  const currentPreset = resolvePreset(palette, isNightMode);

  return (
    <div className={`relative ${className} flex items-center justify-center bg-[#020202]`} style={style}>
      <div
        ref={containerRef}
        className="relative cursor-grab active:cursor-grabbing w-full h-full overflow-hidden select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Dynamic Atmospheric Corona */}
        <div
          className="absolute inset-0 pointer-events-none transition-colors duration-700 ease-out"
          style={{ background: `radial-gradient(circle at 50% 50%, ${atmosColor} 0%, transparent 60%)` }}
        />

        {/* Loading Progress State */}
        {loadingProgress < 100 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020202] z-50">
            <div className="w-64 h-1 bg-white/10 rounded overflow-hidden mb-3">
              <div
                className="h-full bg-blue-500 transition-all duration-150"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="font-mono text-[10px] text-blue-300 tracking-widest uppercase animate-pulse">
              {loadingText}
            </div>
            <div className="mt-2 text-[9px] text-white/20 font-mono">
              Generating {Math.floor(250 * (loadingProgress / 100))}k Holographic Matrix Points
            </div>
          </div>
        )}

        {/* Tactical Telemetry Corner Display */}
        {loadingProgress === 100 && (
          <div className="absolute bottom-6 right-6 font-mono text-[10px] text-white/30 text-right pointer-events-none select-none">
            <div className="mb-1">
              <span className="transition-colors duration-500 text-cyan-400 font-bold">{telemetry.fps}</span> FPS
            </div>
            <div className="space-y-0.5">
              <div>LAT {telemetry.lat.toString().padStart(4)}°</div>
              <div>LON {telemetry.lon.toString().padStart(4)}°</div>
              <div className="text-white/10">ALT {telemetry.alt}km</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
