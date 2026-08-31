import React, { useState, useEffect, useRef, useCallback } from 'react';
import RotatingEarth from './components/RotatingEarth';
import HolographicInterface from './components/ChatPanel';
import BootSequence from './components/BootSequence';
import ControlDeck from './components/ControlDeck';
import TacticalOverlay from './components/TacticalOverlay';
import {
  Coordinates,
  ColorwayPalette,
  HoverTelemetry,
} from './types';
import {
  Map,
  Sun,
  Moon,
  Layers,
  Sparkles,
  Compass,
  Radio,
  Maximize2,
  Minimize2,
  RotateCcw,
  Activity,
} from 'lucide-react';
import { formatCoordinatesAll } from './utils/coordinates';

const App: React.FC = () => {
  // Navigation & Coordinate State
  const [currentCoords, setCurrentCoords] = useState<Coordinates>({ lat: 0, lon: 0 });
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | null>(null);
  const [hoverTelemetry, setHoverTelemetry] = useState<HoverTelemetry | null>(null);
  const [targetScreenPos, setTargetScreenPos] = useState<{
    x: number;
    y: number;
    depth: number;
    isVisible: boolean;
  } | null>(null);

  // Shader & Rendering Parameters (M3 Requirements R1)
  const [palette, setPalette] = useState<ColorwayPalette>('cyber_cyan');
  const [pointDensity, setPointDensity] = useState<number>(150000);
  const [solarAngle, setSolarAngle] = useState<number>(135);
  const [edgeSensitivity, setEdgeSensitivity] = useState<number>(0.5);
  const [autoOrbit, setAutoOrbit] = useState<boolean>(true);
  const [orbitSpeed, setOrbitSpeed] = useState<number>(0.3);
  const [dragFriction, setDragFriction] = useState<number>(0.94);

  // Layout & UI State
  const [dimensions, setDimensions] = useState({ width: 800, height: 800 });
  const [isBooting, setIsBooting] = useState(true);
  const [isControlDeckCollapsed, setIsControlDeckCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // ResizeObserver for viewport dimensions
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // View change callback (lat/lon orientation of globe)
  const handleViewChange = useCallback((viewOrLat: any, maybeLon?: number) => {
    if (typeof viewOrLat === 'number' && typeof maybeLon === 'number') {
      setCurrentCoords({ lat: viewOrLat, lon: maybeLon });
    } else if (viewOrLat && typeof viewOrLat === 'object' && 'lat' in viewOrLat && 'lon' in viewOrLat) {
      setCurrentCoords({ lat: viewOrLat.lat, lon: viewOrLat.lon });
    }
  }, []);

  // Target location selection handler (click on globe or search)
  const handleLocationSelect = useCallback((arg1: Coordinates | number, arg2?: number) => {
    if (typeof arg1 === 'number' && typeof arg2 === 'number') {
      const coords = { lat: arg1, lon: arg2 };
      setSelectedCoords(coords);
      setCurrentCoords(coords);
    } else if (arg1 && typeof arg1 === 'object' && 'lat' in arg1 && 'lon' in arg1) {
      setSelectedCoords(arg1 as Coordinates);
      setCurrentCoords(arg1 as Coordinates);
    }
  }, []);

  // Theme styling helpers
  const isNightMode = palette === 'night_radar';

  const getThemeColors = () => {
    switch (palette) {
      case 'night_radar':
        return {
          text: 'text-red-400',
          border: 'border-red-500/30',
          badgeBg: 'bg-red-950/40 text-red-300 border-red-500/30',
          accentBg: 'bg-red-500/10',
        };
      case 'day_satellite':
        return {
          text: 'text-emerald-400',
          border: 'border-emerald-500/30',
          badgeBg: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30',
          accentBg: 'bg-emerald-500/10',
        };
      case 'holographic_gold':
        return {
          text: 'text-amber-400',
          border: 'border-amber-500/30',
          badgeBg: 'bg-amber-950/40 text-amber-300 border-amber-500/30',
          accentBg: 'bg-amber-500/10',
        };
      case 'cyber_cyan':
      default:
        return {
          text: 'text-cyan-400',
          border: 'border-cyan-500/30',
          badgeBg: 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30',
          accentBg: 'bg-cyan-500/10',
        };
    }
  };

  const themeColors = getThemeColors();

  // Formatted active coordinates
  const formattedCenter = formatCoordinatesAll(currentCoords.lat, currentCoords.lon);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#020202] text-white selection:bg-cyan-500/30 font-sans">
      {/* 0. BOOT SEQUENCE */}
      {isBooting && (
        <div className="absolute inset-0 z-[100] transition-opacity duration-1000 ease-in-out">
          <BootSequence onComplete={() => setIsBooting(false)} />
        </div>
      )}

      {/* 1. BACKGROUND: WebGL Holographic Globe Canvas */}
      <div
        ref={containerRef}
        className={`absolute inset-0 z-0 transition-all duration-1000 ${
          isBooting ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'
        }`}
      >
        <RotatingEarth
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full"
          palette={palette}
          pointDensity={pointDensity}
          solarAngle={solarAngle}
          edgeSensitivity={edgeSensitivity}
          autoOrbit={autoOrbit}
          orbitSpeed={orbitSpeed}
          dragFriction={dragFriction}
          interactive={true}
          selectedLocation={selectedCoords}
          onLocationSelect={handleLocationSelect}
          onHoverChange={setHoverTelemetry}
          onTargetScreenPosChange={setTargetScreenPos}
          onViewChange={handleViewChange}
          isNightMode={isNightMode}
        />
      </div>

      {/* 2. TACTICAL RETICLE & OVERLAY LAYER */}
      <TacticalOverlay
        targetScreenPos={targetScreenPos}
        selectedCoords={selectedCoords}
        hoverTelemetry={hoverTelemetry}
        palette={palette}
        targetCardPosition={{ x: 16, y: 64, width: 320, height: 380 }}
      />

      {/* 3. FOREGROUND: Holographic HUD UI Layer */}
      <div
        className={`absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 md:p-6 transition-all duration-1000 delay-300 ${
          isBooting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}
      >
        {/* TOP BAR: Header, Telemetry Readout & Quick Controls */}
        <header className="flex items-start justify-between pointer-events-auto gap-4">
          {/* Logo & System Badge */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-3 px-4 py-2 rounded-2xl border backdrop-blur-xl bg-black/60 shadow-lg ${themeColors.border}`}
            >
              <div className={`p-1.5 rounded-lg ${themeColors.accentBg}`}>
                <Map className={`w-4 h-4 ${themeColors.text}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold tracking-widest text-xs font-mono text-white">
                    TERRAGEMINI
                  </h1>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white/60">
                    V3.0
                  </span>
                </div>
                <div className="text-[9px] font-mono text-white/40 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${themeColors.text} bg-current animate-pulse`} />
                  <span>HOLOGRAPHIC CARTOGRAPHY</span>
                </div>
              </div>
            </div>

            {/* Quick Live Telemetry Center Ticker (Desktop) */}
            <div className="hidden lg:flex items-center gap-4 px-4 py-2 rounded-2xl border border-white/10 backdrop-blur-xl bg-black/50 font-mono text-[10px] text-white/60">
              <div className="flex items-center gap-1.5">
                <Compass className={`w-3.5 h-3.5 ${themeColors.text}`} />
                <span>CENTER:</span>
                <span className="text-white font-bold">{formattedCenter.dd}</span>
              </div>
              <div className="h-3 w-[1px] bg-white/10" />
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>GRID:</span>
                <span className="text-cyan-300">{formattedCenter.mgrs.slice(0, 10)}</span>
              </div>
              <div className="h-3 w-[1px] bg-white/10" />
              <div className="flex items-center gap-1.5">
                <Sun className="w-3 h-3 text-amber-400" />
                <span>SOLAR:</span>
                <span className="text-amber-300">{Math.round(solarAngle)}°</span>
              </div>
            </div>
          </div>

          {/* Quick Palette / Theme Action Pill */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const palettes: ColorwayPalette[] = [
                  'cyber_cyan',
                  'night_radar',
                  'day_satellite',
                  'holographic_gold',
                ];
                const nextIdx = (palettes.indexOf(palette) + 1) % palettes.length;
                setPalette(palettes[nextIdx]);
              }}
              title="Cycle Colorway Palette"
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl border backdrop-blur-xl bg-black/60 shadow-lg hover:bg-white/10 transition-all font-mono text-[10px] ${themeColors.border} ${themeColors.text}`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="uppercase font-bold tracking-wider hidden sm:inline">
                {palette.replace('_', ' ')}
              </span>
            </button>

            {/* Clear Target Pin Button (if selected) */}
            {selectedCoords && (
              <button
                type="button"
                onClick={() => setSelectedCoords(null)}
                title="Clear selected target"
                className="p-2.5 rounded-2xl border border-white/10 backdrop-blur-xl bg-black/60 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* FLOATING RIGHT CONTROL DECK (Collapsible HUD) */}
        <aside className="absolute top-20 right-4 md:right-6 z-40 pointer-events-auto">
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
            isCollapsed={isControlDeckCollapsed}
            onToggleCollapse={() => setIsControlDeckCollapsed(!isControlDeckCollapsed)}
          />
        </aside>

        {/* CENTER / BOTTOM: Intelligence Uplink & Left Pop-Out Target Visualizer */}
        <HolographicInterface
          currentCoords={currentCoords}
          selectedCoords={selectedCoords}
          isNightMode={isNightMode}
          onLocationSearch={handleLocationSelect}
        />
      </div>
    </div>
  );
};

export default App;