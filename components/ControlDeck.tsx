import React, { useState } from 'react';
import {
  Sliders,
  Sun,
  Layers,
  Compass,
  Orbit,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  RotateCcw,
  Eye,
  Crosshair,
  Gauge,
} from 'lucide-react';
import { ColorwayPalette } from '../types';

export interface ControlDeckProps {
  palette: ColorwayPalette;
  onPaletteChange: (palette: ColorwayPalette) => void;
  pointDensity: number;
  onPointDensityChange: (density: number) => void;
  solarAngle: number;
  onSolarAngleChange: (angle: number) => void;
  edgeSensitivity: number;
  onEdgeSensitivityChange: (sensitivity: number) => void;
  autoOrbit: boolean;
  onAutoOrbitChange: (autoOrbit: boolean) => void;
  orbitSpeed: number;
  onOrbitSpeedChange: (speed: number) => void;
  dragFriction: number;
  onDragFrictionChange: (friction: number) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

interface PaletteOption {
  id: ColorwayPalette;
  name: string;
  subtitle: string;
  badgeColor: string;
  accentHex: string;
  glowHex: string;
  icon: string;
}

const PALETTE_OPTIONS: PaletteOption[] = [
  {
    id: 'night_radar',
    name: 'Night Radar',
    subtitle: 'Crimson Sweep & Obsidian Sea',
    badgeColor: 'bg-red-500/20 border-red-500/50 text-red-400',
    accentHex: '#ef4444',
    glowHex: 'rgba(239, 68, 68, 0.4)',
    icon: '🔴',
  },
  {
    id: 'day_satellite',
    name: 'Day Satellite',
    subtitle: 'Atmospheric Limb & Blue Oceans',
    badgeColor: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
    accentHex: '#10b981',
    glowHex: 'rgba(16, 185, 129, 0.4)',
    icon: '🟢',
  },
  {
    id: 'cyber_cyan',
    name: 'Cyber Cyan',
    subtitle: 'Tron Hologram & Neon Matrix',
    badgeColor: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400',
    accentHex: '#06b6d4',
    glowHex: 'rgba(6, 182, 212, 0.4)',
    icon: '🔵',
  },
  {
    id: 'holographic_gold',
    name: 'Holographic Gold',
    subtitle: 'Amber Vector & Solar Corona',
    badgeColor: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
    accentHex: '#f59e0b',
    glowHex: 'rgba(245, 158, 11, 0.4)',
    icon: '🟡',
  },
];

export const ControlDeck: React.FC<ControlDeckProps> = ({
  palette,
  onPaletteChange,
  pointDensity,
  onPointDensityChange,
  solarAngle,
  onSolarAngleChange,
  edgeSensitivity,
  onEdgeSensitivityChange,
  autoOrbit,
  onAutoOrbitChange,
  orbitSpeed,
  onOrbitSpeedChange,
  dragFriction,
  onDragFrictionChange,
  isCollapsed: controlledCollapsed,
  onToggleCollapse,
  className = '',
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  // Normalization for palette matching (handles kebab vs underscore)
  const normalizedPalette = (palette || 'cyber_cyan').toString().replace('-', '_') as ColorwayPalette;

  // Active theme styling derived from active palette
  const activePaletteConfig =
    PALETTE_OPTIONS.find((p) => p.id === normalizedPalette) || PALETTE_OPTIONS[2];

  const getThemeAccentClass = () => {
    switch (normalizedPalette) {
      case 'night_radar':
        return {
          text: 'text-red-400',
          border: 'border-red-500/40',
          bgGlow: 'bg-red-500/10',
          ring: 'focus:ring-red-500',
          sliderThumb: 'accent-red-500',
          glowShadow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
        };
      case 'day_satellite':
        return {
          text: 'text-emerald-400',
          border: 'border-emerald-500/40',
          bgGlow: 'bg-emerald-500/10',
          ring: 'focus:ring-emerald-500',
          sliderThumb: 'accent-emerald-500',
          glowShadow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
        };
      case 'holographic_gold':
        return {
          text: 'text-amber-400',
          border: 'border-amber-500/40',
          bgGlow: 'bg-amber-500/10',
          ring: 'focus:ring-amber-500',
          sliderThumb: 'accent-amber-500',
          glowShadow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
        };
      case 'cyber_cyan':
      default:
        return {
          text: 'text-cyan-400',
          border: 'border-cyan-500/40',
          bgGlow: 'bg-cyan-500/10',
          ring: 'focus:ring-cyan-500',
          sliderThumb: 'accent-cyan-500',
          glowShadow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]',
        };
    }
  };

  const theme = getThemeAccentClass();

  const handleResetDefaults = () => {
    onPointDensityChange(150000);
    onSolarAngleChange(135);
    onEdgeSensitivityChange(0.5);
    onAutoOrbitChange(true);
    onOrbitSpeedChange(0.3);
    onDragFrictionChange(0.94);
  };

  return (
    <div
      className={`
        w-80 md:w-88 backdrop-blur-xl bg-black/85 
        border ${theme.border} ${theme.glowShadow}
        rounded-2xl shadow-2xl overflow-hidden
        transition-all duration-300 pointer-events-auto
        ${className}
      `}
    >
      {/* 1. DECK HEADER */}
      <div
        onClick={toggleCollapse}
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03] cursor-pointer select-none hover:bg-white/[0.06] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${theme.bgGlow} border border-white/10`}>
            <Sliders className={`w-4 h-4 ${theme.text}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold tracking-wider text-white">
                CONTROL DECK
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                SYS.V4
              </span>
            </div>
            <p className="text-[10px] font-mono text-white/40">Real-Time WebGL Shader HUD</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleResetDefaults();
            }}
            title="Reset to default parameters"
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label={isCollapsed ? 'Expand Control Deck' : 'Collapse Control Deck'}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. EXPANDABLE BODY */}
      {!isCollapsed && (
        <div className="p-4 space-y-5 max-h-[75vh] overflow-y-auto font-sans text-xs scrollbar-thin scrollbar-thumb-white/20">
          {/* SECTION A: COLORWAY PALETTE SELECTION */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[11px] font-semibold tracking-wider text-white/80 flex items-center gap-1.5">
                <Layers className={`w-3.5 h-3.5 ${theme.text}`} />
                COLORWAY PALETTE
              </label>
              <span className={`font-mono text-[10px] uppercase ${theme.text} font-bold`}>
                {activePaletteConfig.name}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PALETTE_OPTIONS.map((item) => {
                const isSelected = normalizedPalette === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onPaletteChange(item.id)}
                    className={`
                      relative p-2.5 rounded-xl text-left transition-all duration-200
                      border flex flex-col justify-between h-20 group
                      ${
                        isSelected
                          ? `bg-white/[0.08] ${item.badgeColor} shadow-lg ring-1`
                          : 'bg-white/[0.02] border-white/10 text-white/60 hover:bg-white/[0.05] hover:border-white/20'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-base">{item.icon}</span>
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          backgroundColor: item.accentHex,
                          boxShadow: isSelected ? `0 0 8px ${item.accentHex}` : 'none',
                        }}
                      />
                    </div>
                    <div>
                      <div className="font-mono text-[11px] font-bold tracking-tight text-white leading-tight">
                        {item.name}
                      </div>
                      <div className="text-[9px] text-white/40 truncate mt-0.5 font-mono">
                        {item.id.replace('_', ' ')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION B: POINT CLOUD DENSITY (50k - 250k) */}
          <div className="space-y-2 pt-1 border-t border-white/5">
            <div className="flex items-center justify-between font-mono">
              <label
                htmlFor="slider-point-density"
                className="text-[11px] text-white/80 flex items-center gap-1.5"
              >
                <Sparkles className={`w-3.5 h-3.5 ${theme.text}`} />
                POINT DENSITY
              </label>
              <div className="flex items-center gap-1">
                <span className={`text-[11px] font-bold ${theme.text}`}>
                  {(pointDensity / 1000).toFixed(0)}k
                </span>
                <span className="text-[9px] text-white/40">/ 250k PTS</span>
              </div>
            </div>

            <div className="relative">
              <input
                id="slider-point-density"
                type="range"
                min={50000}
                max={250000}
                step={5000}
                value={pointDensity}
                onChange={(e) => onPointDensityChange(Number(e.target.value))}
                className={`w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer ${theme.sliderThumb}`}
              />
              <div className="flex justify-between text-[9px] font-mono text-white/30 mt-1">
                <span>50k (Fast)</span>
                <span>150k (Balanced)</span>
                <span>250k (Ultra)</span>
              </div>
            </div>
          </div>

          {/* SECTION C: SOLAR ANGLE / SPECULAR GLIDE (0° - 360°) */}
          <div className="space-y-2 pt-1 border-t border-white/5">
            <div className="flex items-center justify-between font-mono">
              <label
                htmlFor="slider-solar-angle"
                className="text-[11px] text-white/80 flex items-center gap-1.5"
              >
                <Sun className={`w-3.5 h-3.5 ${theme.text}`} />
                SOLAR AZIMUTH
              </label>
              <div className="flex items-center gap-1">
                <span className={`text-[11px] font-bold ${theme.text}`}>
                  {Math.round(solarAngle)}°
                </span>
                <span className="text-[9px] text-white/40">SPECULAR GLIDE</span>
              </div>
            </div>

            <div className="relative">
              <input
                id="slider-solar-angle"
                type="range"
                min={0}
                max={360}
                step={1}
                value={solarAngle}
                onChange={(e) => onSolarAngleChange(Number(e.target.value))}
                className={`w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer ${theme.sliderThumb}`}
              />
              <div className="flex justify-between text-[9px] font-mono text-white/30 mt-1">
                <span>0° (Dawn)</span>
                <span>180° (Noon)</span>
                <span>360° (Dusk)</span>
              </div>
            </div>
          </div>

          {/* SECTION D: COASTLINE SOBEL EDGE SENSITIVITY (0.0 - 1.0) */}
          <div className="space-y-2 pt-1 border-t border-white/5">
            <div className="flex items-center justify-between font-mono">
              <label
                htmlFor="slider-edge-sensitivity"
                className="text-[11px] text-white/80 flex items-center gap-1.5"
              >
                <Activity className={`w-3.5 h-3.5 ${theme.text}`} />
                SOBEL EDGE CONVOLUTION
              </label>
              <div className="flex items-center gap-1">
                <span className={`text-[11px] font-bold ${theme.text}`}>
                  {edgeSensitivity.toFixed(2)}
                </span>
                <span className="text-[9px] text-white/40">THRESHOLD</span>
              </div>
            </div>

            <div className="relative">
              <input
                id="slider-edge-sensitivity"
                type="range"
                min={0.0}
                max={1.0}
                step={0.02}
                value={edgeSensitivity}
                onChange={(e) => onEdgeSensitivityChange(Number(e.target.value))}
                className={`w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer ${theme.sliderThumb}`}
              />
              <div className="flex justify-between text-[9px] font-mono text-white/30 mt-1">
                <span>0.00 (Soft)</span>
                <span>0.50 (Normal)</span>
                <span>1.00 (Sharp)</span>
              </div>
            </div>
          </div>

          {/* SECTION E: ROTATION PHYSICS & AUTO-ORBIT */}
          <div className="space-y-3 pt-1 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-white/80 flex items-center gap-1.5">
                <Orbit className={`w-3.5 h-3.5 ${theme.text}`} />
                ROTATION DYNAMICS
              </span>

              {/* Auto-Orbit Toggle Button */}
              <button
                type="button"
                onClick={() => onAutoOrbitChange(!autoOrbit)}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[10px] font-semibold transition-all
                  border ${
                    autoOrbit
                      ? `${theme.bgGlow} ${theme.border} ${theme.text} shadow-sm`
                      : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    autoOrbit ? 'bg-current animate-pulse' : 'bg-white/30'
                  }`}
                />
                <span>AUTO-ORBIT: {autoOrbit ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            {/* Orbit Speed Slider (enabled if autoOrbit is true) */}
            <div className={`space-y-1.5 transition-opacity ${autoOrbit ? 'opacity-100' : 'opacity-40'}`}>
              <div className="flex items-center justify-between font-mono">
                <label htmlFor="slider-orbit-speed" className="text-[10px] text-white/60">
                  Orbit Speed Velocity
                </label>
                <span className={`text-[10px] font-bold ${theme.text}`}>
                  {orbitSpeed.toFixed(2)}x
                </span>
              </div>
              <input
                id="slider-orbit-speed"
                type="range"
                min={0.05}
                max={1.5}
                step={0.05}
                disabled={!autoOrbit}
                value={orbitSpeed}
                onChange={(e) => onOrbitSpeedChange(Number(e.target.value))}
                className={`w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer ${theme.sliderThumb}`}
              />
            </div>

            {/* Drag Friction Damping Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-mono">
                <label htmlFor="slider-drag-friction" className="text-[10px] text-white/60">
                  Momentum Damping (Friction)
                </label>
                <span className={`text-[10px] font-bold ${theme.text}`}>
                  {dragFriction.toFixed(3)}
                </span>
              </div>
              <input
                id="slider-drag-friction"
                type="range"
                min={0.8}
                max={0.99}
                step={0.005}
                value={dragFriction}
                onChange={(e) => onDragFrictionChange(Number(e.target.value))}
                className={`w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer ${theme.sliderThumb}`}
              />
              <div className="flex justify-between text-[9px] font-mono text-white/30">
                <span>0.80 (Heavy Drag)</span>
                <span>0.94 (Fluid)</span>
                <span>0.99 (Inertial)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DECK FOOTER STATUS BAR */}
      <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-white/30 select-none">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
          <span>GPU SHADER STREAM</span>
        </div>
        <span>UNIFORM PIPELINE ACTIVE</span>
      </div>
    </div>
  );
};

export default ControlDeck;
