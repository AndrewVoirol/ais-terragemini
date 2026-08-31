import React, { useState, useEffect, useRef } from 'react';
import {
  Coordinates,
  CoordinateFormat,
  ColorwayPalette,
  HoverTelemetry,
} from '../types';
import {
  Scan,
  Radar,
  RefreshCw,
  WifiOff,
  Mountain,
  Waves,
  ShieldCheck,
  Crosshair,
  MapPin,
} from 'lucide-react';
import {
  latLonToMGRS,
  latLonToDD,
  latLonToDMS,
  latLonToUTM,
  getSectorGridCode,
  formatUTM,
} from '../utils/coordinates';
import { getEstimatedElevation, classifyTerrain } from '../utils/elevation';
import { getSphericalDistance, getBearing } from '../utils/projection';

export interface TargetVisualizerProps {
  isLoading?: boolean;
  imageUrl?: string | null;
  coords?: Coordinates | null;
  hoverTelemetry?: HoverTelemetry | null;
  palette?: ColorwayPalette;
  isNightMode?: boolean;
  onCardPositionChange?: (pos: { x: number; y: number; width: number; height: number } | null) => void;
  onFormatChange?: (format: CoordinateFormat) => void;
  className?: string;
}

export const TargetVisualizer: React.FC<TargetVisualizerProps> = ({
  isLoading = false,
  imageUrl = null,
  coords = null,
  hoverTelemetry = null,
  palette = 'cyber_cyan',
  isNightMode = false,
  onCardPositionChange,
  onFormatChange,
  className = '',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<CoordinateFormat>('MGRS');
  const cardRef = useRef<HTMLDivElement>(null);

  // Normalize palette
  const normalizedPalette = (
    palette || (isNightMode ? 'night_radar' : 'cyber_cyan')
  )
    .toString()
    .replace('-', '_') as ColorwayPalette;

  const handleFormatSelect = (fmt: CoordinateFormat) => {
    setSelectedFormat(fmt);
    if (onFormatChange) {
      onFormatChange(fmt);
    }
  };

  // Report DOM bounding box position to parent for SVG leader line tracking
  useEffect(() => {
    if (cardRef.current && onCardPositionChange) {
      const rect = cardRef.current.getBoundingClientRect();
      onCardPositionChange({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }
  });

  // Derived theme styling
  const getTheme = () => {
    switch (normalizedPalette) {
      case 'night_radar':
        return {
          text: 'text-red-400',
          textMuted: 'text-red-300/70',
          border: 'border-red-500/40',
          bgGlow: 'bg-red-500/10',
          glowShadow: 'shadow-[0_0_25px_rgba(239,68,68,0.2)]',
          pillActive: 'bg-red-500 text-white font-bold',
          badge: 'bg-red-500/20 text-red-400 border-red-500/30',
          indicator: 'bg-red-500',
        };
      case 'day_satellite':
        return {
          text: 'text-emerald-400',
          textMuted: 'text-emerald-300/70',
          border: 'border-emerald-500/40',
          bgGlow: 'bg-emerald-500/10',
          glowShadow: 'shadow-[0_0_25px_rgba(16,185,129,0.2)]',
          pillActive: 'bg-emerald-500 text-white font-bold',
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          indicator: 'bg-emerald-500',
        };
      case 'holographic_gold':
        return {
          text: 'text-amber-400',
          textMuted: 'text-amber-300/70',
          border: 'border-amber-500/40',
          bgGlow: 'bg-amber-500/10',
          glowShadow: 'shadow-[0_0_25px_rgba(245,158,11,0.2)]',
          pillActive: 'bg-amber-500 text-black font-bold',
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          indicator: 'bg-amber-500',
        };
      case 'cyber_cyan':
      default:
        return {
          text: 'text-cyan-400',
          textMuted: 'text-cyan-300/70',
          border: 'border-cyan-500/40',
          bgGlow: 'bg-cyan-500/10',
          glowShadow: 'shadow-[0_0_25px_rgba(6,182,212,0.2)]',
          pillActive: 'bg-cyan-500 text-black font-bold',
          badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
          indicator: 'bg-cyan-500',
        };
    }
  };

  const theme = getTheme();

  // Compute elevation & terrain classification for locked coordinates
  const targetElevation = coords ? getEstimatedElevation(coords.lat, coords.lon) : null;
  const targetTerrain = coords && targetElevation
    ? classifyTerrain(coords.lat, coords.lon, targetElevation.elevationMeters)
    : null;
  const targetSector = coords ? getSectorGridCode(coords.lat, coords.lon) : null;
  const targetBearing = coords ? getBearing({ lat: 0, lon: 0 }, coords) : 0;
  const targetDistance = coords ? getSphericalDistance({ lat: 0, lon: 0 }, coords) : 0;

  // Format coordinates according to active format
  const getFormattedCoordinateValue = (lat: number, lon: number, format: CoordinateFormat): string => {
    switch (format) {
      case 'MGRS':
        return latLonToMGRS(lat, lon, 5);
      case 'DD':
        return latLonToDD(lat, lon, 5);
      case 'DMS':
        return latLonToDMS(lat, lon);
      case 'UTM': {
        const utm = latLonToUTM(lat, lon);
        return formatUTM(utm);
      }
      default:
        return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
    }
  };

  // Lock State: SEARCHING -> ACQUIRING -> LOCKED
  const lockState: 'SEARCHING' | 'ACQUIRING' | 'LOCKED' = !coords
    ? 'SEARCHING'
    : isLoading
    ? 'ACQUIRING'
    : 'LOCKED';

  return (
    <div
      ref={cardRef}
      className={`
        w-80 md:w-88 backdrop-blur-xl bg-black/85 
        border ${theme.border} ${theme.glowShadow}
        rounded-2xl shadow-2xl overflow-hidden
        transition-all duration-300 pointer-events-auto
        ${className}
      `}
    >
      {/* 1. TOP STATUS HEADER */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2">
          {lockState === 'LOCKED' ? (
            <Scan className={`w-4 h-4 ${theme.text} animate-pulse`} />
          ) : lockState === 'ACQUIRING' ? (
            <RefreshCw className={`w-4 h-4 ${theme.text} animate-spin`} />
          ) : (
            <Radar className="w-4 h-4 text-white/40 animate-spin-slow" />
          )}
          <span className="font-mono text-[11px] font-bold tracking-wider text-white">
            {lockState === 'LOCKED'
              ? 'SAT.FEED_V.04'
              : lockState === 'ACQUIRING'
              ? 'ACQUIRING LOCK'
              : 'SECTOR_SCAN'}
          </span>
        </div>

        {/* Lock State Pill Badge */}
        <div className="flex items-center gap-1.5 font-mono text-[9px]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              lockState === 'LOCKED'
                ? `${theme.indicator} animate-ping`
                : lockState === 'ACQUIRING'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-white/30'
            }`}
          />
          <span
            className={`px-1.5 py-0.5 rounded ${
              lockState === 'LOCKED'
                ? theme.badge
                : lockState === 'ACQUIRING'
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-white/10 text-white/40'
            }`}
          >
            {lockState === 'SEARCHING' ? 'IDLE' : lockState}
          </span>
        </div>
      </div>

      {/* 2. SEGMENTED COORDINATE FORMAT TOGGLE [ MGRS | DD | DMS | UTM ] */}
      <div className="px-3 py-2 border-b border-white/5 bg-black/40 flex items-center justify-between">
        <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">
          FORMAT
        </span>
        <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 gap-0.5">
          {(['MGRS', 'DD', 'DMS', 'UTM'] as CoordinateFormat[]).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => handleFormatSelect(fmt)}
              className={`
                px-2 py-0.5 rounded font-mono text-[9px] transition-all
                ${
                  selectedFormat === fmt
                    ? theme.pillActive
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }
              `}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* 3. MAIN VISUAL & TELEMETRY SECTION */}
      {!coords ? (
        /* STANDBY / IDLE SCANNING STATE */
        <div className="p-4 space-y-3">
          <div className="h-32 relative bg-black/50 rounded-xl border border-white/5 flex flex-col items-center justify-center overflow-hidden">
            {/* Animated Grid Lines */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="w-16 h-16 rounded-full border border-dashed border-white/20 flex items-center justify-center animate-spin">
              <Crosshair className="w-6 h-6 text-white/20" />
            </div>
            <div className="mt-2 font-mono text-[10px] text-white/40 tracking-widest text-center">
              <div>AWAITING TARGET</div>
              <div>COORDINATES</div>
            </div>
            <div className="text-[9px] font-mono text-white/20 mt-1">
              Click any point on globe to lock
            </div>
          </div>

          {/* LIVE HOVER MINI READOUT (WHEN MOUSE IS OVER GLOBE) */}
          {hoverTelemetry && (
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-[10px] space-y-1">
              <div className="flex items-center justify-between text-white/50 text-[9px]">
                <span className="flex items-center gap-1">
                  <MapPin className={`w-3 h-3 ${theme.text}`} />
                  LIVE CURSOR PROBE
                </span>
                <span className={theme.text}>{hoverTelemetry.sectorCode}</span>
              </div>
              <div className="text-white font-bold tracking-tight">
                {getFormattedCoordinateValue(
                  hoverTelemetry.coords.lat,
                  hoverTelemetry.coords.lon,
                  selectedFormat
                )}
              </div>
              <div className="flex justify-between text-[9px] text-white/40 pt-0.5">
                <span>
                  ELEV: {hoverTelemetry.elevationMeters >= 0 ? '+' : ''}
                  {Math.round(hoverTelemetry.elevationMeters)}m
                </span>
                <span className="uppercase text-white/60">{hoverTelemetry.terrainType}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ACTIVE LOCKED TARGET TELEMETRY */
        <div className="p-3.5 space-y-3">
          {/* Target Imagery Feed */}
          <div className="relative aspect-video bg-black/90 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden group">
            {/* Visual Scanline Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <RefreshCw className={`w-6 h-6 ${theme.text} animate-spin`} />
                <span className="font-mono text-[10px] text-white/50 tracking-widest uppercase">
                  Acquiring Visual...
                </span>
              </div>
            ) : imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt="Target Visual"
                  className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[size:100%_4px] opacity-25" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 p-3 text-center">
                <WifiOff className="w-5 h-5 text-white/30" />
                <span className="text-[10px] font-mono text-red-400/80">VISUAL FEED OFFLINE</span>
                <span className="text-[8px] font-mono text-white/30">
                  LAT: {coords.lat.toFixed(3)}° // LON: {coords.lon.toFixed(3)}°
                </span>
              </div>
            )}

            {/* Corner Sci-Fi Bracket Accents */}
            <div className={`absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 ${theme.border}`} />
            <div className={`absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 ${theme.border}`} />
            <div className={`absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 ${theme.border}`} />
            <div className={`absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 ${theme.border}`} />

            {/* Target Coordinate Tag on Image */}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm border border-white/15 font-mono text-[9px] text-white/90">
              {getFormattedCoordinateValue(coords.lat, coords.lon, selectedFormat)}
            </div>
          </div>

          {/* Precision Elevation & Topography Readout */}
          {targetElevation && (
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="text-white/40 flex items-center gap-1">
                  {targetElevation.elevationMeters >= 0 ? (
                    <Mountain className={`w-3.5 h-3.5 ${theme.text}`} />
                  ) : (
                    <Waves className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  {targetElevation.elevationMeters >= 0 ? 'ELEVATION' : 'ABYSSAL DEPTH'}
                </span>
                <span className={`font-bold ${theme.text}`}>
                  {targetElevation.elevationMeters >= 0
                    ? `+${Math.round(targetElevation.elevationMeters).toLocaleString()}m`
                    : `${Math.round(targetElevation.elevationMeters).toLocaleString()}m`}
                </span>
              </div>

              {/* Normalized Elevation Gauge Bar */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    targetElevation.elevationMeters >= 0 ? 'bg-amber-400' : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.max(5, targetElevation.normalizedElevation * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-white/40">
                <span>TERRAIN: {targetTerrain?.toUpperCase()}</span>
                <span>SECTOR: {targetSector}</span>
              </div>
            </div>
          )}

          {/* Grid of Tactical Metrics (Azimuth, Range, Encryption) */}
          <div className="grid grid-cols-3 gap-1.5 font-mono text-[9px]">
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col">
              <span className="text-white/30">AZIMUTH</span>
              <span className="text-white/80 font-bold mt-0.5">
                {Math.round(targetBearing).toString().padStart(3, '0')}° TRUE
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col">
              <span className="text-white/30">RANGE</span>
              <span className="text-white/80 font-bold mt-0.5">
                {Math.round(targetDistance).toLocaleString()} km
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col">
              <span className="text-white/30">CIPHER</span>
              <span className="text-white/80 font-bold mt-0.5">AES-256</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. FOOTER STATUS BAR */}
      <div className="px-3.5 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-white/30">
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>TELEMETRY SECURE</span>
        </div>
        <span>WGS-84 ELLIPSOID</span>
      </div>
    </div>
  );
};

export default TargetVisualizer;