import React, { useEffect, useRef, useState } from "react"
import { geoGraticule, geoEquirectangular, geoPath } from "d3-geo"
import { feature } from "topojson-client"
import type { Topology, GeometryCollection } from "topojson-specification"

interface RotatingEarthProps {
  width?: number
  height?: number
  className?: string
  onViewChange?: (lat: number, lon: number) => void
  onLocationSelect?: (lat: number, lon: number) => void
  isNightMode?: boolean
  selectedLocation?: { lat: number, lon: number } | null
}

const DATA_SOURCES = {
  primary: {
    // The key used for the Cache API
    cacheKey: "world-atlas-land-50m-v2",
    urls: [
      "https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json",
      "https://unpkg.com/world-atlas@2.0.2/land-50m.json"
    ],
  },
}

// -----------------------------------------------------------------------------
// WEBGL SHADERS
// -----------------------------------------------------------------------------

const VS_DOTS = `
attribute vec2 a_pos;
uniform vec2 u_rotation; 
uniform float u_scale;
uniform vec2 u_resolution;
uniform float u_point_size;
uniform float u_time;

varying float v_intensity;
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
    
    // Projection
    vec2 screenPos = rotated.xy * u_scale;
    vec2 ndc = screenPos / (u_resolution * 0.5);
    ndc.y = -ndc.y; // Flip Y
    
    gl_Position = vec4(ndc, 0.0, 1.0);
    
    // Visual Polish
    // 1. Fresnel / Curvature fade: Dots at edge (z near 0) are smaller/dimmer
    float fresnel = smoothstep(0.0, 0.3, rotated.z);
    
    // 2. Size attenuation
    float size = u_point_size;
    // Slight pulse effect
    float pulse = 1.0 + sin(u_time * 2.0 + p.x * 10.0) * 0.1;
    
    gl_PointSize = size * fresnel * pulse * (1.0 + rotated.z * 0.3);
    
    v_intensity = fresnel;
}
`;

const FS_DOTS = `
precision mediump float;
uniform vec4 u_color;
varying float v_intensity;

void main() {
    // Circular smooth dot
    vec2 coord = gl_PointCoord * 2.0 - 1.0;
    float dist = length(coord);
    if (dist > 1.0) discard;
    
    // High quality anti-aliasing
    float alpha = 1.0 - smoothstep(0.8, 1.0, dist);
    
    // Mix color based on intensity (Fresnel)
    vec3 finalColor = u_color.rgb;
    
    gl_FragColor = vec4(finalColor, u_color.a * alpha * v_intensity);
}
`;

const VS_LINES = `
attribute vec2 a_pos;
uniform vec2 u_rotation;
uniform float u_scale;
uniform vec2 u_resolution;

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
    
    vec2 screenPos = rotated.xy * u_scale;
    vec2 ndc = screenPos / (u_resolution * 0.5);
    ndc.y = -ndc.y;
    
    // Push lines slightly behind dots (z=0.01)
    gl_Position = vec4(ndc, 0.01, 1.0);
}
`;

const FS_LINES = `
precision mediump float;
uniform vec4 u_color;
varying float v_z;

void main() {
    if (v_z < 0.0) discard;
    float alpha = smoothstep(0.0, 0.15, v_z);
    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;

// Updated Shader: A Vertical Beam "Pin"
const VS_MARKER = `
attribute vec2 a_pos; // Single point [lon, lat]
attribute float a_offset; // 0.0 = base, 1.0 = top of beam

uniform vec2 u_rotation;
uniform float u_scale;
uniform vec2 u_resolution;
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
    
    // Extrude based on offset (Create a beam)
    // Base is at radius 1.0, Top is at radius 1.4 for extra visibility
    float height = 1.0 + (a_offset * 0.5); 
    p *= height;

    vec3 rotated = rotateY(u_rotation.x * DEG2RAD) * p;
    rotated = rotateX(u_rotation.y * DEG2RAD) * rotated;
    
    v_z = rotated.z;
    v_offset = a_offset;
    
    // Hide if behind globe
    if (rotated.z < -0.3) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
    }
    
    vec2 screenPos = rotated.xy * u_scale;
    vec2 ndc = screenPos / (u_resolution * 0.5);
    ndc.y = -ndc.y;
    
    gl_Position = vec4(ndc, 0.0, 1.0);
    
    // Make the top of the pin a Large Flare
    if (a_offset > 0.9) {
       gl_PointSize = 32.0; 
    } else {
       gl_PointSize = 12.0;
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
        // TOP: A Glowing Star
        float glow = 1.0 - dist;
        glow = pow(glow, 2.0);
        alpha = glow;
    } else {
        // BASE: A fast pulsing ring (Shockwave)
        float pulse = fract(u_time * 1.5); // 0 to 1 loop
        float ringRadius = pulse;
        float width = 0.2 * (1.0 - pulse); // thinner as it expands
        float d = abs(dist - ringRadius) - width;
        
        // Only draw the ring, fade out as it expands
        if (d < 0.0) {
            alpha = (1.0 - pulse) * 0.8; 
        } else {
            // Also draw a solid core dot
            if (dist < 0.3) alpha = 1.0;
        }
    }
    
    gl_FragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;


export default function RotatingEarth({ width = 800, height = 600, className = "", onViewChange, onLocationSelect, isNightMode = false, selectedLocation }: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Refs for logic (avoid stale closures)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const stateRef = useRef({
    rotation: [0, -20] as [number, number],
    velocity: [0.5, 0] as [number, number],
    scale: 0, 
    targetScale: 0,
    isDragging: false,
    lastInteraction: 0,
    time: 0,
    // 0 = Day (Blue), 1 = Night (Gold)
    themeTransition: isNightMode ? 1.0 : 0.0,
    selectedLocation: null as null | { lat: number, lon: number },
    flyToTarget: null as null | { lat: number, lon: number, startTime: number, startRot: [number, number] },
  })
  
  // Track props in ref for render loop access
  const isNightModeRef = useRef(isNightMode)
  useEffect(() => { isNightModeRef.current = isNightMode }, [isNightMode])

  // Sync prop selectedLocation with internal state
  useEffect(() => {
    if (selectedLocation) {
        const s = stateRef.current;
        // Don't restart fly-to if it's the same
        const isSame = s.selectedLocation && Math.abs(s.selectedLocation.lat - selectedLocation.lat) < 0.001 && Math.abs(s.selectedLocation.lon - selectedLocation.lon) < 0.001;
        
        if (!isSame) {
            s.selectedLocation = selectedLocation;
            s.flyToTarget = {
                lat: selectedLocation.lat,
                lon: selectedLocation.lon,
                startTime: performance.now(),
                startRot: [...s.rotation]
            };
        }
    } else {
        // Only clear if prop is explicitly null (deselect)
        if (selectedLocation === null) {
             stateRef.current.selectedLocation = null;
        }
    }
  }, [selectedLocation]);

  // Shader Program Refs
  const progDotsRef = useRef<WebGLProgram | null>(null)
  const progLinesRef = useRef<WebGLProgram | null>(null)
  const progMarkerRef = useRef<WebGLProgram | null>(null)
  
  // Buffer Refs
  const bufDotsRef = useRef<WebGLBuffer | null>(null)
  const bufLinesRef = useRef<WebGLBuffer | null>(null)
  const bufStarsRef = useRef<WebGLBuffer | null>(null)
  const bufMarkerRef = useRef<WebGLBuffer | null>(null)
  const bufBeamRef = useRef<WebGLBuffer | null>(null)
  
  // Counters
  const countsRef = useRef({ dots: 0, lines: 0, stars: 0 })
  const isLoadedRef = useRef(false)
  const onViewChangeRef = useRef(onViewChange)
  const onLocationSelectRef = useRef(onLocationSelect)
  
  // React State for UI
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingText, setLoadingText] = useState("Initializing System...")
  const [error, setError] = useState<string | null>(null)
  const [telemetry, setTelemetry] = useState({ fps: 0, lat: 0, lon: 0, alt: 0 })

  // Current Atmosphere Color (CSS)
  const [atmosColor, setAtmosColor] = useState('rgba(30,60,100,0.1)')

  useEffect(() => { onViewChangeRef.current = onViewChange }, [onViewChange])
  useEffect(() => { onLocationSelectRef.current = onLocationSelect }, [onLocationSelect])

  // ---------------------------------------------------------------------------
  // 1. SETUP WEBGL & SHADERS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Initialize Zoom
    stateRef.current.scale = Math.min(width, height) / 2.5
    stateRef.current.targetScale = stateRef.current.scale

    const gl = canvas.getContext('webgl', { alpha: false, antialias: true })
    if (!gl) { setError("WebGL Failed"); return }
    glRef.current = gl

    // Compile Shader Helper
    const compile = (vs: string, fs: string) => {
        const createS = (type: number, src: string) => {
            const s = gl.createShader(type); if(!s) return null;
            gl.shaderSource(s, src); gl.compileShader(s);
            if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
            return s;
        }
        const v = createS(gl.VERTEX_SHADER, vs);
        const f = createS(gl.FRAGMENT_SHADER, fs);
        if(!v || !f) return null;
        const p = gl.createProgram(); if(!p) return null;
        gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p);
        return p;
    }

    progDotsRef.current = compile(VS_DOTS, FS_DOTS)
    progLinesRef.current = compile(VS_LINES, FS_LINES)
    progMarkerRef.current = compile(VS_MARKER, FS_MARKER)

    // Generate Stars
    const starCount = 2000
    const stars = new Float32Array(starCount * 2)
    for(let i=0; i<starCount; i++) {
        stars[i*2] = Math.random() * 360 // lon
        stars[i*2+1] = (Math.random() - 0.5) * 180 // lat
    }
    const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, stars, gl.STATIC_DRAW);
    bufStarsRef.current = sb;
    countsRef.current.stars = starCount;

    // Generate Graticule Lines
    const graticule = geoGraticule().step([10, 10])();
    const lineCoords: number[] = [];
    // @ts-ignore
    graticule.coordinates.forEach((line: number[][]) => {
        for(let i=0; i<line.length-1; i++) {
            lineCoords.push(line[i][0], line[i][1]);
            lineCoords.push(line[i+1][0], line[i+1][1]);
        }
    });
    const lb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineCoords), gl.STATIC_DRAW);
    bufLinesRef.current = lb;
    countsRef.current.lines = lineCoords.length / 2;
    
    // Init Marker Buffer
    const mb = gl.createBuffer();
    bufMarkerRef.current = mb;
    
    const bb = gl.createBuffer();
    bufBeamRef.current = bb;

  }, [])

  // ---------------------------------------------------------------------------
  // 2. DATA LOADING & GENERATION (HIGH RES with CACHE API)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isLoadedRef.current) { setLoadingProgress(100); return }
    
    const controller = new AbortController()
    
    const fetchTopology = async (): Promise<Topology> => {
        const { cacheKey, urls } = DATA_SOURCES.primary;
        
        // 1. Try Cache API first
        if ('caches' in window) {
            try {
                const cache = await caches.open('terragemini-maps-v1');
                const cachedRes = await cache.match(cacheKey);
                if (cachedRes) {
                    return await cachedRes.json();
                }
            } catch (e) {
                console.warn("Cache access error", e);
            }
        }

        // 2. Network Fallback with Redundancy
        for (const url of urls) {
            if (controller.signal.aborted) throw new Error("Aborted");
            try {
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                
                // Cache the success for next time
                if ('caches' in window) {
                    try {
                        const cache = await caches.open('terragemini-maps-v1');
                        await cache.put(cacheKey, res.clone());
                    } catch (e) { console.warn("Cache write failed", e); }
                }
                
                return await res.json();
            } catch (e) {
                console.warn(`Failed to load from ${url}, trying next...`);
            }
        }
        
        throw new Error("All data sources failed");
    };

    const load = async () => {
        try {
            setLoadingText("Downloading Topography...")
            setLoadingProgress(15)
            
            // 1. Robust Fetch
            const topo = await fetchTopology();
            
            setLoadingProgress(40)
            setLoadingText("Processing High-Res Grid...")
            
            // 2. Generate Points (Time-Sliced)
            // Use standard Canvas (main thread) but slice work to keep UI responsive
            const size = 4096 // 4K Resolution scan
            const canvas = document.createElement('canvas')
            canvas.width = size; canvas.height = size/2
            const ctx = canvas.getContext('2d')
            if(!ctx) throw new Error("Canvas Error")
            
            const land = feature(topo, (topo.objects.land || topo.objects.countries) as GeometryCollection)
            const projection = geoEquirectangular().fitSize([size, size/2], land)
            const path = geoPath(projection, ctx)
            
            ctx.fillStyle = '#fff'; ctx.beginPath(); path(land); ctx.fill();
            
            const imgData = ctx.getImageData(0,0, size, size/2).data
            const coords: number[] = []
            
            // Config for Density
            const step = 2 // Very dense
            const width = size; const height = size/2
            
            // Generator loop
            for (let y = 0; y < height; y += step) {
                if(controller.signal.aborted) return;
                
                // Offset every other row for hexagonal packing feel
                const xOff = (y/step)%2 === 0 ? 0 : Math.floor(step/2)
                
                for (let x = xOff; x < width; x += step) {
                    const i = (y * width + x) * 4
                    if(imgData[i] > 100) {
                        const lat = 90 - (y / height) * 180
                        // Cosine Rejection Sampling for uniform sphere density
                        if (Math.random() > Math.cos(lat * (Math.PI/180))) continue;
                        
                        const lon = (x / width) * 360 - 180
                        coords.push(lon, lat)
                    }
                }
                
                // Yield to UI
                if(y % 200 === 0) {
                    setLoadingProgress(40 + Math.floor((y/height)*60))
                    await new Promise(r => setTimeout(r, 0))
                }
            }
            
            // Upload
            const gl = glRef.current
            if(gl && !controller.signal.aborted) {
                const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW);
                bufDotsRef.current = b;
                countsRef.current.dots = coords.length / 2;
                isLoadedRef.current = true
                setLoadingProgress(100)
            }
            
        } catch (e: any) {
            if(e.name !== 'AbortError' && e.message !== 'Aborted') {
                console.error(e);
                setError("Map Load Error")
            }
        }
    }
    
    load();
    return () => controller.abort();
  }, [])

  // ---------------------------------------------------------------------------
  // 3. RENDER LOOP & PHYSICS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (loadingProgress < 100) return;

    let animId = 0
    let lastT = performance.now()
    let frame = 0
    let fpsT = lastT
    
    // Theme Colors (RGB)
    const DAY_DOT = [0.3, 0.6, 1.0];
    const NIGHT_DOT = [1.0, 0.7, 0.3]; // Gold/Amber
    
    const render = (now: number) => {
        const dt = Math.min(now - lastT, 50)
        lastT = now
        const gl = glRef.current
        const s = stateRef.current
        
        if (!gl) return;
        
        // --- THEME TRANSITION ---
        const targetT = isNightModeRef.current ? 1.0 : 0.0;
        // Smooth lerp
        s.themeTransition += (targetT - s.themeTransition) * 0.05;
        const tt = s.themeTransition;

        // Mix Colors
        const r = DAY_DOT[0] * (1-tt) + NIGHT_DOT[0] * tt;
        const g = DAY_DOT[1] * (1-tt) + NIGHT_DOT[1] * tt;
        const b = DAY_DOT[2] * (1-tt) + NIGHT_DOT[2] * tt;
        
        // --- PHYSICS ---
        s.time += dt * 0.001
        
        // 1. Zoom Spring
        const zoomDiff = s.targetScale - s.scale;
        s.scale += zoomDiff * 0.1;

        // 2. Fly To Animation
        if (s.flyToTarget) {
            // Easing function for fly-to
            const duration = 1500; // ms
            const elapsed = now - s.flyToTarget.startTime;
            const progress = Math.min(1.0, elapsed / duration);
            const ease = 1 - Math.pow(1 - progress, 3); // Cubic ease out
            
            const targetRotX = -s.flyToTarget.lon;
            const targetRotY = -s.flyToTarget.lat;
            
            // Interpolate Rotation
            let startX = s.flyToTarget.startRot[0];
            let diffX = targetRotX - startX;
            // Shortest path
            while (diffX > 180) diffX -= 360;
            while (diffX < -180) diffX += 360;
            
            s.rotation[0] = startX + diffX * ease;
            s.rotation[1] = s.flyToTarget.startRot[1] + (targetRotY - s.flyToTarget.startRot[1]) * ease;
            
            if (progress >= 1.0) {
                s.flyToTarget = null;
                s.velocity = [0,0];
            }
        }
        // 3. Normal Rotation / Inertia
        else if (!s.isDragging) {
            // Friction
            s.velocity[0] *= 0.96;
            s.velocity[1] *= 0.96;
            
            // Auto Spin if not selected something
            if (!s.selectedLocation) {
                if (Math.abs(s.velocity[0]) < 0.2 && Math.abs(s.velocity[1]) < 0.01) {
                    s.velocity[0] += (0.8 - s.velocity[0]) * 0.01; // Increased auto-spin speed
                }
            } else {
                // If selected, dampen to stop
                if (Math.abs(s.velocity[0]) < 0.01) s.velocity[0] = 0;
            }
            
            s.rotation[0] += s.velocity[0];
            s.rotation[1] += s.velocity[1];
            
            s.rotation[1] = Math.max(-85, Math.min(85, s.rotation[1]));
        }

        // --- RESIZE ---
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const dw = Math.floor(width * dpr)
        const dh = Math.floor(height * dpr)
        const canvas = canvasRef.current
        if(canvas && (canvas.width !== dw || canvas.height !== dh)) {
            canvas.width = dw; canvas.height = dh
            gl.viewport(0, 0, dw, dh)
        }

        // --- DRAW ---
        gl.clearColor(0.02, 0.02, 0.02, 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        const uniforms = (p: WebGLProgram) => {
            gl.useProgram(p)
            gl.uniform2f(gl.getUniformLocation(p, "u_rotation"), s.rotation[0], s.rotation[1])
            gl.uniform1f(gl.getUniformLocation(p, "u_scale"), s.scale)
            gl.uniform2f(gl.getUniformLocation(p, "u_resolution"), dw, dh)
            gl.uniform1f(gl.getUniformLocation(p, "u_time"), s.time)
            return (name: string) => gl.getAttribLocation(p, name)
        }

        // 1. Stars (Background)
        if (bufStarsRef.current && progDotsRef.current) {
            const attr = uniforms(progDotsRef.current)
            gl.bindBuffer(gl.ARRAY_BUFFER, bufStarsRef.current)
            gl.enableVertexAttribArray(attr("a_pos"))
            gl.vertexAttribPointer(attr("a_pos"), 2, gl.FLOAT, false, 0, 0)
            
            gl.uniform2f(gl.getUniformLocation(progDotsRef.current, "u_rotation"), s.rotation[0] * 0.1, s.rotation[1] * 0.1)
            gl.uniform1f(gl.getUniformLocation(progDotsRef.current, "u_scale"), s.scale * 3.0) 
            gl.uniform1f(gl.getUniformLocation(progDotsRef.current, "u_point_size"), 1.5 * dpr)
            
            const starAlpha = 0.2 * (1.0 - (tt * 0.4));
            gl.uniform4f(gl.getUniformLocation(progDotsRef.current, "u_color"), 1.0, 1.0, 1.0, starAlpha)
            gl.drawArrays(gl.POINTS, 0, countsRef.current.stars)
        }

        // 2. Graticule Lines
        if (bufLinesRef.current && progLinesRef.current) {
            const attr = uniforms(progLinesRef.current)
            gl.bindBuffer(gl.ARRAY_BUFFER, bufLinesRef.current)
            gl.enableVertexAttribArray(attr("a_pos"))
            gl.vertexAttribPointer(attr("a_pos"), 2, gl.FLOAT, false, 0, 0)
            
            const lr = 1.0 * (1-tt) + 1.0 * tt;
            const lg = 1.0 * (1-tt) + 0.8 * tt;
            const lb = 1.0 * (1-tt) + 0.5 * tt;
            const lAlpha = 0.04 * (1.0 - (tt * 0.3));
            
            gl.uniform4f(gl.getUniformLocation(progLinesRef.current, "u_color"), lr, lg, lb, lAlpha)
            gl.drawArrays(gl.LINES, 0, countsRef.current.lines)
        }

        // 3. Land Dots (Foreground)
        if (bufDotsRef.current && progDotsRef.current) {
            const attr = uniforms(progDotsRef.current)
            gl.bindBuffer(gl.ARRAY_BUFFER, bufDotsRef.current)
            gl.enableVertexAttribArray(attr("a_pos"))
            gl.vertexAttribPointer(attr("a_pos"), 2, gl.FLOAT, false, 0, 0)
            
            gl.uniform1f(gl.getUniformLocation(progDotsRef.current, "u_point_size"), 1.8 * dpr)
            gl.uniform4f(gl.getUniformLocation(progDotsRef.current, "u_color"), r, g, b, 0.9)
            gl.drawArrays(gl.POINTS, 0, countsRef.current.dots)
        }

        // 4. Selection Marker (Pin / Beam)
        if (s.selectedLocation && bufMarkerRef.current && progMarkerRef.current) {
            const attr = uniforms(progMarkerRef.current)
            const mr = 0.5 * (1-tt) + 1.0 * tt;
            const mg = 1.0 * (1-tt) + 0.5 * tt;
            const mb = 1.0 * (1-tt) + 0.2 * tt;
            gl.uniform4f(gl.getUniformLocation(progMarkerRef.current, "u_color"), mr, mg, mb, 1.0)
            
            // Draw Points (Base and Top)
            const data = new Float32Array([
                s.selectedLocation.lon, s.selectedLocation.lat, 0.0, // Base
                s.selectedLocation.lon, s.selectedLocation.lat, 1.0  // Top
            ]);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, bufMarkerRef.current)
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
            gl.enableVertexAttribArray(attr("a_pos"))
            gl.vertexAttribPointer(attr("a_pos"), 2, gl.FLOAT, false, 12, 0)
            const aOffset = gl.getAttribLocation(progMarkerRef.current, "a_offset");
            if (aOffset !== -1) {
                gl.enableVertexAttribArray(aOffset)
                gl.vertexAttribPointer(aOffset, 1, gl.FLOAT, false, 12, 8) 
            }
            gl.drawArrays(gl.POINTS, 0, 2)
            
            // Draw Beam Line
            const beamPoints = [];
            for(let i=0; i<=20; i++) {
                beamPoints.push(s.selectedLocation.lon, s.selectedLocation.lat, i/20);
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, bufBeamRef.current);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(beamPoints), gl.DYNAMIC_DRAW);
            gl.vertexAttribPointer(attr("a_pos"), 2, gl.FLOAT, false, 12, 0)
            if (aOffset !== -1) gl.vertexAttribPointer(aOffset, 1, gl.FLOAT, false, 12, 8)
            
            gl.drawArrays(gl.POINTS, 0, 21);
        }

        // Telemetry
        frame++
        if(now - fpsT >= 500) {
            const lat = Math.round(-s.rotation[1])
            const lon = Math.round(((-s.rotation[0] % 360) + 360) % 360)
            const alt = Math.round((2000 / s.scale) * 100)
            setTelemetry({ fps: Math.round(frame*1000/(now-fpsT)), lat, lon, alt })
            
            const aR = 30 * (1-tt) + 100 * tt;
            const aG = 60 * (1-tt) + 60 * tt;
            const aB = 100 * (1-tt) + 30 * tt;
            setAtmosColor(`rgba(${Math.round(aR)},${Math.round(aG)},${Math.round(aB)}, ${0.1 - (tt*0.03)})`)

            frame = 0; fpsT = now
            
            if (onViewChangeRef.current) {
                const nLon = ((-s.rotation[0] % 360) + 540) % 360 - 180
                onViewChangeRef.current(lat, nLon)
            }
        }
        
        animId = requestAnimationFrame(render)
    }
    
    animId = requestAnimationFrame(render)
    
    // --- INPUT HANDLERS ---
    
    // RAYCASTING HELPER
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

    const onClick = (e: MouseEvent) => {
        const s = stateRef.current;
        if (s.isDragging) return;
        if (Math.abs(s.velocity[0]) > 2.0 || Math.abs(s.velocity[1]) > 2.0) return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mx = e.clientX - rect.left - rect.width/2;
        const my = e.clientY - rect.top - rect.height/2;
        const result = getLatLonFromMouse(mx, my);
        
        if (result) {
            s.selectedLocation = result;
            s.flyToTarget = {
                lat: result.lat,
                lon: result.lon,
                startTime: performance.now(),
                startRot: [...s.rotation]
            };
            if (onLocationSelectRef.current) {
                onLocationSelectRef.current(result.lat, result.lon);
            }
        }
    }

    const onDown = (e: MouseEvent) => {
        const s = stateRef.current;
        s.isDragging = true; s.velocity = [0,0];
        s.flyToTarget = null;
        const last = { x: e.clientX, y: e.clientY }
        const onMove = (mv: MouseEvent) => {
            const dx = mv.clientX - last.x
            const dy = mv.clientY - last.y
            last.x = mv.clientX; last.y = mv.clientY
            s.rotation[0] += dx * 0.4
            s.rotation[1] -= dy * 0.4
            s.rotation[1] = Math.max(-85, Math.min(85, s.rotation[1]))
            s.velocity = [dx * 0.4, -dy * 0.4]
        }
        const onUp = () => {
            setTimeout(() => { s.isDragging = false }, 0);
            document.removeEventListener('mousemove', onMove)
            document.removeEventListener('mouseup', onUp)
        }
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
    }
    
    const onWheel = (e: WheelEvent) => {
        const s = stateRef.current;
        e.preventDefault()
        const dir = e.deltaY > 0 ? -1 : 1;
        const multiplier = 1 + (0.2 * Math.abs(dir));
        if (dir > 0) s.targetScale *= multiplier;
        else s.targetScale /= multiplier;
        const minScale = Math.min(width, height) / 5;
        const maxScale = Math.min(width, height) * 3;
        s.targetScale = Math.max(minScale, Math.min(maxScale, s.targetScale));
    }

    const c = containerRef.current
    if (c) {
        c.addEventListener('mousedown', onDown)
        c.addEventListener('click', onClick)
        c.addEventListener('wheel', onWheel, { passive: false })
    }

    return () => {
        cancelAnimationFrame(animId)
        if (c) {
            c.removeEventListener('mousedown', onDown)
            c.removeEventListener('click', onClick)
            c.removeEventListener('wheel', onWheel)
        }
    }
  }, [loadingProgress, width, height, selectedLocation])


  if (error) return <div className="flex h-full items-center justify-center text-red-500">{error}</div>

  return (
    <div className={`relative ${className} flex items-center justify-center bg-[#020202]`}>
        <div ref={containerRef} className="relative cursor-grab active:cursor-grabbing w-full h-full overflow-hidden">
            <canvas ref={canvasRef} className="block w-full h-full" />
            
            {/* Dynamic Atmosphere Ring */}
            <div className="absolute inset-0 pointer-events-none transition-colors duration-500" 
                 style={{ background: `radial-gradient(circle at 50% 50%, ${atmosColor} 0%, transparent 60%)` }} />

            {loadingProgress < 100 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#020202] z-50">
                    <div className="w-64 h-1 bg-white/10 rounded overflow-hidden mb-3">
                        <div className="h-full bg-blue-500 transition-all duration-100" style={{ width: `${loadingProgress}%` }}/>
                    </div>
                    <div className="font-mono text-[10px] text-blue-300 tracking-widest uppercase animate-pulse">{loadingText}</div>
                    <div className="mt-2 text-[9px] text-white/20 font-mono">Generating {Math.floor(150 * (loadingProgress/100))}k Holographic Points</div>
                </div>
            )}
            
            {loadingProgress === 100 && (
                <div className="absolute bottom-6 right-6 font-mono text-[10px] text-white/30 text-right pointer-events-none select-none">
                   <div className="mb-1">
                      <span className={`transition-colors duration-500 ${isNightMode ? 'text-amber-500' : 'text-blue-500'}`}>{telemetry.fps}</span> FPS
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
  )
}