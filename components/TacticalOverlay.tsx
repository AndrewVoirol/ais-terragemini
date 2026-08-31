import React from 'react';
import { Coordinates, ColorwayPalette, HoverTelemetry } from '../types';
import { Crosshair, ShieldAlert, Radio } from 'lucide-react';

export interface TargetScreenPos {
  x: number;
  y: number;
  depth: number;
  isVisible: boolean;
}

export interface CardPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface TacticalOverlayProps {
  targetScreenPos: TargetScreenPos | null;
  selectedCoords: Coordinates | null;
  hoverTelemetry?: HoverTelemetry | null;
  palette?: ColorwayPalette;
  targetCardPosition?: CardPosition | null;
  className?: string;
}

export const TacticalOverlay: React.FC<TacticalOverlayProps> = ({
  targetScreenPos,
  selectedCoords,
  hoverTelemetry,
  palette = 'cyber_cyan',
  targetCardPosition,
  className = '',
}) => {
  const normalizedPalette = (palette || 'cyber_cyan').toString().replace('-', '_') as ColorwayPalette;

  // Theme-aware colors
  const getColors = () => {
    switch (normalizedPalette) {
      case 'night_radar':
        return {
          primaryHex: '#ef4444',
          accentHex: '#f87171',
          svgStroke: '#ef4444',
          glowFilter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.7))',
          textColor: 'text-red-400',
          borderColor: 'border-red-500/50',
          bgGlow: 'bg-red-500/20',
        };
      case 'day_satellite':
        return {
          primaryHex: '#10b981',
          accentHex: '#34d399',
          svgStroke: '#10b981',
          glowFilter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.7))',
          textColor: 'text-emerald-400',
          borderColor: 'border-emerald-500/50',
          bgGlow: 'bg-emerald-500/20',
        };
      case 'holographic_gold':
        return {
          primaryHex: '#f59e0b',
          accentHex: '#fbbf24',
          svgStroke: '#f59e0b',
          glowFilter: 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.7))',
          textColor: 'text-amber-400',
          borderColor: 'border-amber-500/50',
          bgGlow: 'bg-amber-500/20',
        };
      case 'cyber_cyan':
      default:
        return {
          primaryHex: '#06b6d4',
          accentHex: '#22d3ee',
          svgStroke: '#06b6d4',
          glowFilter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.7))',
          textColor: 'text-cyan-400',
          borderColor: 'border-cyan-500/50',
          bgGlow: 'bg-cyan-500/20',
        };
    }
  };

  const colors = getColors();

  // Target Lock state computations
  const hasTarget = Boolean(selectedCoords && targetScreenPos);
  const isOccluded = hasTarget && targetScreenPos ? (!targetScreenPos.isVisible || targetScreenPos.depth <= 0) : false;
  const targetX = targetScreenPos ? targetScreenPos.x : 0;
  const targetY = targetScreenPos ? targetScreenPos.y : 0;

  // Leader line coordinates computation
  // If targetCardPosition is provided, connect to its center-right or bottom-right edge; otherwise fallback to top-left HUD anchor
  const cardX = targetCardPosition ? targetCardPosition.x + (targetCardPosition.width || 320) : 320;
  const cardY = targetCardPosition ? targetCardPosition.y + (targetCardPosition.height ? targetCardPosition.height * 0.45 : 120) : 160;

  // Construct dynamic elbow path from target anchor to card anchor
  const getLeaderPath = (x1: number, y1: number, x2: number, y2: number) => {
    const midX = x1 < x2 ? x1 + Math.abs(x2 - x1) * 0.4 : x1 - Math.abs(x2 - x1) * 0.4;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${x2} ${y2}`;
  };

  // Hover Crosshair coordinates
  const hoverScreenPos = hoverTelemetry?.screenPos;
  const hasHover = Boolean(hoverTelemetry && hoverScreenPos && hoverScreenPos.isVisible);

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden z-20 select-none ${className}`}
      aria-hidden="true"
    >
      {/* 1. DYNAMIC SVG LEADER LINE LAYER */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: colors.glowFilter }}>
        <defs>
          <linearGradient id="leaderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.primaryHex} stopOpacity={isOccluded ? 0.2 : 0.9} />
            <stop offset="100%" stopColor={colors.accentHex} stopOpacity={isOccluded ? 0.05 : 0.4} />
          </linearGradient>
          <filter id="hudGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Dynamic Leader Path */}
        {hasTarget && !isOccluded && (
          <g className="transition-opacity duration-300">
            {/* Background glowing line */}
            <path
              d={getLeaderPath(targetX, targetY, cardX, cardY)}
              fill="none"
              stroke={colors.primaryHex}
              strokeWidth="2.5"
              strokeOpacity="0.3"
            />
            {/* Foreground animated dashed line */}
            <path
              d={getLeaderPath(targetX, targetY, cardX, cardY)}
              fill="none"
              stroke="url(#leaderGradient)"
              strokeWidth="1.5"
              strokeDasharray="6 3"
              className="animate-pulse"
            />
            {/* Target anchor ring node */}
            <circle cx={targetX} cy={targetY} r="4" fill={colors.primaryHex} fillOpacity="0.8" />
            <circle cx={targetX} cy={targetY} r="8" fill="none" stroke={colors.accentHex} strokeWidth="1" strokeDasharray="3 2" />
            {/* Card anchor node */}
            <circle cx={cardX} cy={cardY} r="3" fill={colors.primaryHex} />
          </g>
        )}
      </svg>

      {/* 2. PINNED 3D TARGET RETICLE */}
      {hasTarget && (
        <div
          className="absolute transition-all duration-75 ease-out"
          style={{
            left: `${targetX}px`,
            top: `${targetY}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {isOccluded ? (
            /* OCCLUDED TARGET STATE (Far Hemisphere) */
            <div className="relative flex flex-col items-center justify-center opacity-35 hover:opacity-75 transition-opacity">
              {/* Ghosted Dashed Rings */}
              <div className="w-16 h-16 rounded-full border border-dashed border-white/40 flex items-center justify-center animate-pulse">
                <div className="w-10 h-10 rounded-full border border-dotted border-white/30" />
                <div className="w-2 h-2 rounded-full bg-white/40" />
              </div>

              {/* Horizon Indicator Badge */}
              <div className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/80 border border-white/20 text-[9px] font-mono text-white/60 tracking-wider">
                <ShieldAlert className="w-3 h-3 text-amber-400" />
                <span>HORIZON OCCLUDED</span>
              </div>
            </div>
          ) : (
            /* ACTIVE 3D PINNED TARGET RETICLE */
            <div className="relative flex flex-col items-center justify-center">
              {/* Center Lock Pulse */}
              <div
                className="absolute w-2 h-2 rounded-full animate-ping"
                style={{ backgroundColor: colors.primaryHex }}
              />
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: colors.primaryHex,
                  boxShadow: `0 0 10px ${colors.primaryHex}`,
                }}
              />

              {/* Concentric Radar Lock Rings */}
              <div
                className="absolute w-14 h-14 rounded-full border border-dashed animate-spin"
                style={{
                  borderColor: `${colors.primaryHex}88`,
                  animationDuration: '12s',
                }}
              />

              <div
                className="absolute w-20 h-20 rounded-full border border-dotted"
                style={{
                  borderColor: `${colors.accentHex}66`,
                }}
              />

              {/* Outer Rotating Sci-Fi Brackets */}
              <div
                className="absolute w-24 h-24 pointer-events-none animate-spin"
                style={{ animationDuration: '24s', animationDirection: 'reverse' }}
              >
                {/* 4 Corner tick marks */}
                <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 ${colors.borderColor}`} />
                <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 ${colors.borderColor}`} />
                <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 ${colors.borderColor}`} />
                <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 ${colors.borderColor}`} />
              </div>

              {/* Azimuth / Crosshair Ticks */}
              <div className="absolute w-28 h-28 pointer-events-none flex items-center justify-center">
                <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              </div>

              {/* Target Metadata Callout Tag */}
              <div
                className={`
                  absolute top-14 left-1/2 -translate-x-1/2 
                  px-2.5 py-1 rounded-md backdrop-blur-md bg-black/85 
                  border ${colors.borderColor} shadow-lg 
                  flex items-center gap-1.5 whitespace-nowrap
                `}
              >
                <Radio className={`w-3 h-3 ${colors.textColor} animate-pulse`} />
                <span className="font-mono text-[9px] font-bold text-white tracking-widest">
                  TGT LOCKED
                </span>
                <span className="font-mono text-[9px] text-white/50 border-l border-white/20 pl-1.5">
                  {selectedCoords ? `${selectedCoords.lat.toFixed(2)}°, ${selectedCoords.lon.toFixed(2)}°` : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. MICRO HOVER CROSSHAIR TRACKER */}
      {hasHover && hoverScreenPos && (
        <div
          className="absolute transition-transform duration-75 ease-out pointer-events-none"
          style={{
            left: `${hoverScreenPos.x}px`,
            top: `${hoverScreenPos.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="relative flex items-center justify-center">
            {/* Micro Reticle Crosshair */}
            <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
              <Crosshair className={`w-4 h-4 ${colors.textColor} opacity-80`} />
            </div>

            {/* Hover Tooltip Telemetry */}
            <div className="absolute left-8 top-0 -translate-y-1/2 ml-2 px-2 py-1 rounded bg-black/80 backdrop-blur-md border border-white/15 text-[9px] font-mono shadow-xl whitespace-nowrap flex flex-col gap-0.5 pointer-events-none">
              <div className="flex items-center gap-1.5 text-white/90 font-bold">
                <span className={`w-1.5 h-1.5 rounded-full ${colors.bgGlow}`} />
                <span>{hoverTelemetry.formatted.dd}</span>
              </div>
              <div className="flex items-center gap-2 text-white/40 text-[8px]">
                <span className={colors.textColor}>{hoverTelemetry.sectorCode}</span>
                <span>•</span>
                <span>
                  {hoverTelemetry.elevationMeters >= 0 ? '+' : ''}
                  {Math.round(hoverTelemetry.elevationMeters)}m
                </span>
                <span>•</span>
                <span className="uppercase">{hoverTelemetry.terrainType}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TacticalOverlay;
