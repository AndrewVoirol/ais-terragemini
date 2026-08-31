import React from 'react';

/**
 * Geographic latitude and longitude coordinates in decimal degrees (WGS84).
 */
export interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * 4 distinct holographic & tactical WebGL colorway presets.
 */
export type ColorwayPalette =
  | 'night_radar'
  | 'day_satellite'
  | 'cyber_cyan'
  | 'holographic_gold';

/**
 * Supported tactical coordinate display formats.
 */
export type CoordinateFormat = 'MGRS' | 'DD' | 'DMS' | 'UTM';

/**
 * Comprehensive formatted coordinate strings across all tactical notations.
 */
export interface FormattedCoordinates {
  dd: string;
  dms: string;
  utm: string;
  mgrs: string;
  raw: Coordinates;
}

/**
 * Topographic terrain classification categories.
 */
export type TerrainType =
  | 'ocean'
  | 'coastal'
  | 'plains'
  | 'hills'
  | 'mountains'
  | 'high_plateau';

/**
 * Real-time cursor hover telemetry over the spherical globe.
 */
export interface HoverTelemetry {
  coords: Coordinates;
  formatted: FormattedCoordinates;
  elevationMeters: number;
  normalizedElevation: number; // 0.0 (trench) to 1.0 (Everest)
  terrainType: TerrainType;
  sectorCode: string; // e.g. "SEC-18T-WV"
  screenPos?: {
    x: number;
    y: number;
    depth: number;
    isVisible: boolean;
  };
}

/**
 * Tactical locked target marker placed on the planetary surface.
 */
export interface TargetLock {
  id: string;
  coords: Coordinates;
  formatted: FormattedCoordinates;
  elevationMeters: number;
  terrainType: TerrainType | string;
  timestamp: number;
  label?: string;
  screenPos?: {
    x: number;
    y: number;
    depth: number;
    isVisible: boolean;
  };
}

/**
 * Visual styling and shader uniform configuration for each colorway palette.
 */
export interface PaletteConfig {
  id: ColorwayPalette;
  name: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  glowColor: string;
  borderColor: string;
  landColor: [number, number, number, number]; // RGBA [0..1]
  oceanColor: [number, number, number, number]; // RGBA [0..1]
  atmosColor: string;
  specularColor: [number, number, number]; // RGB [0..1]
  hudTheme: {
    border: string;
    accent: string;
    bg: string;
    glow: string;
  };
}

/**
 * Props contract for the modular, standalone WebGL RotatingEarth component (R3).
 */
export interface RotatingEarthProps {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;

  // Shader Controls (R1)
  palette?: ColorwayPalette;
  pointDensity?: number; // 50,000 to 250,000
  solarAngle?: number; // 0 to 360 degrees
  edgeSensitivity?: number; // 0.0 to 1.0

  // Physics & Navigation
  autoOrbit?: boolean;
  orbitSpeed?: number;
  dragFriction?: number;
  interactive?: boolean;

  // Selection & Telemetry (R2)
  selectedLocation?: Coordinates | null;
  onLocationSelect?: (coords: Coordinates | { lat: number; lon: number }) => void;
  onHoverChange?: (telemetry: HoverTelemetry | null) => void;
  onTargetScreenPosChange?: (
    screenPos: { x: number; y: number; depth: number; isVisible: boolean } | null
  ) => void;
  onViewChange?: (view: { lat: number; lon: number; scale: number; fps: number } | any) => void;
  onReady?: () => void;

  // Backwards compatibility
  isNightMode?: boolean;
}

/**
 * AI / Holographic message payload for the communication uplink.
 */
export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isError?: boolean;
}

/**
 * Chat and intelligence uplink state.
 */
export enum ChatState {
  IDLE,
  LOADING,
  ERROR
}