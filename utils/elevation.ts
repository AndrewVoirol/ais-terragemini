import { TerrainType } from '../types';

/**
 * Known Global Orographic and Mountain Belts with peak elevation centers and influence radii.
 */
interface MountainRegion {
  name: string;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  baseElev: number;
  peakElev: number;
  peakLat: number;
  peakLon: number;
}

const MAJOR_MOUNTAIN_REGIONS: MountainRegion[] = [
  {
    name: 'Himalayas & Tibetan Plateau',
    minLat: 25.0,
    maxLat: 39.0,
    minLon: 68.0,
    maxLon: 105.0,
    baseElev: 4200,
    peakElev: 8848,
    peakLat: 27.9881,
    peakLon: 86.925,
  },
  {
    name: 'Andes Cordillera',
    minLat: -56.0,
    maxLat: 11.0,
    minLon: -80.0,
    maxLon: -64.0,
    baseElev: 2800,
    peakElev: 6961,
    peakLat: -32.6532,
    peakLon: -70.0109,
  },
  {
    name: 'Rocky Mountains & Colorado Plateau',
    minLat: 32.0,
    maxLat: 62.0,
    minLon: -128.0,
    maxLon: -104.0,
    baseElev: 1800,
    peakElev: 4401,
    peakLat: 39.1178,
    peakLon: -106.4454,
  },
  {
    name: 'European Alps',
    minLat: 43.5,
    maxLat: 48.0,
    minLon: 4.5,
    maxLon: 17.0,
    baseElev: 1400,
    peakElev: 4808,
    peakLat: 45.8326,
    peakLon: 6.8652,
  },
  {
    name: 'Caucasus Mountains',
    minLat: 40.0,
    maxLat: 45.0,
    minLon: 39.0,
    maxLon: 50.0,
    baseElev: 1800,
    peakElev: 5642,
    peakLat: 43.3499,
    peakLon: 42.4453,
  },
  {
    name: 'East African Rift & Ethiopian Highlands',
    minLat: -6.0,
    maxLat: 16.0,
    minLon: 34.0,
    maxLon: 43.0,
    baseElev: 1600,
    peakElev: 5895,
    peakLat: -3.0674,
    peakLon: 37.3556,
  },
  {
    name: 'Scandinavian Mountains',
    minLat: 58.0,
    maxLat: 71.0,
    minLon: 5.0,
    maxLon: 24.0,
    baseElev: 700,
    peakElev: 2469,
    peakLat: 61.6364,
    peakLon: 8.3125,
  },
  {
    name: 'Great Dividing Range',
    minLat: -39.0,
    maxLat: -14.0,
    minLon: 142.0,
    maxLon: 153.0,
    baseElev: 600,
    peakElev: 2228,
    peakLat: -36.4559,
    peakLon: 148.2636,
  },
  {
    name: 'Atlas Mountains',
    minLat: 29.0,
    maxLat: 36.0,
    minLon: -10.0,
    maxLon: 10.0,
    baseElev: 1200,
    peakElev: 4167,
    peakLat: 31.0594,
    peakLon: -7.9158,
  },
  {
    name: 'Ural Mountains',
    minLat: 50.0,
    maxLat: 68.0,
    minLon: 56.0,
    maxLon: 64.0,
    baseElev: 500,
    peakElev: 1895,
    peakLat: 65.0333,
    peakLon: 60.1167,
  },
  {
    name: 'Antarctic Ice Sheet',
    minLat: -90.0,
    maxLat: -66.0,
    minLon: -180.0,
    maxLon: 180.0,
    baseElev: 2200,
    peakElev: 4892,
    peakLat: -78.5833,
    peakLon: -85.5833,
  },
  {
    name: 'Greenland Ice Sheet',
    minLat: 60.0,
    maxLat: 83.5,
    minLon: -58.0,
    maxLon: -20.0,
    baseElev: 1800,
    peakElev: 3694,
    peakLat: 68.9167,
    peakLon: -29.9,
  },
];

/**
 * Deep Oceanic Trenches with extreme negative bathymetric depths.
 */
interface OceanicTrench {
  name: string;
  lat: number;
  lon: number;
  radiusDeg: number;
  depthMeters: number;
}

const MAJOR_OCEANIC_TRENCHES: OceanicTrench[] = [
  { name: 'Mariana Trench (Challenger Deep)', lat: 11.3733, lon: 142.1989, radiusDeg: 6.0, depthMeters: -10994 },
  { name: 'Tonga Trench (Horizon Deep)', lat: -23.2833, lon: -174.75, radiusDeg: 5.0, depthMeters: -10800 },
  { name: 'Philippine Trench', lat: 10.1, lon: 126.7, radiusDeg: 5.0, depthMeters: -10540 },
  { name: 'Kurile-Kamchatka Trench', lat: 45.0, lon: 153.0, radiusDeg: 6.0, depthMeters: -10500 },
  { name: 'Puerto Rico Trench (Milwaukee Deep)', lat: 19.7, lon: -66.5, radiusDeg: 4.0, depthMeters: -8376 },
  { name: 'Java Trench', lat: -10.3, lon: 109.9, radiusDeg: 5.0, depthMeters: -7450 },
];

/**
 * Determines whether a given geodetic point is primarily terrestrial land or ocean basin.
 */
export function isGeographicLand(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return false;
  }

  let normalizedLon = ((lon + 180) % 360) - 180;
  if (normalizedLon === 180) normalizedLon = -180;

  // Polar Ice Sheets
  if (lat <= -66.0) return true; // Antarctica
  if (lat >= 60.0 && lat <= 83.5 && normalizedLon >= -58.0 && normalizedLon <= -18.0) return true; // Greenland

  // North America
  if (lat >= 14.0 && lat <= 72.0 && normalizedLon >= -168.0 && normalizedLon <= -52.0) {
    // Exclude Caribbean / Atlantic waters around Puerto Rico Trench & Bahamas
    if (lat < 25.0 && normalizedLon > -80.0) return false;
    // Exclude Gulf of Mexico
    if (lat >= 18.0 && lat <= 30.0 && normalizedLon >= -97.0 && normalizedLon <= -82.0) {
      if (lat < 28.0 && normalizedLon > -95.0 && normalizedLon < -85.0) return false;
    }
    // Exclude Hudson Bay
    if (lat >= 51.0 && lat <= 64.0 && normalizedLon >= -95.0 && normalizedLon <= -78.0) return false;
    return true;
  }

  // South America
  if (lat >= -56.0 && lat <= 13.0 && normalizedLon >= -82.0 && normalizedLon <= -34.0) {
    return true;
  }

  // Eurasia (Europe + Northern Asia)
  if (lat >= 35.0 && lat <= 77.0 && normalizedLon >= -10.0 && normalizedLon <= 180.0) {
    // Exclude Mediterranean Sea
    if (lat >= 30.0 && lat <= 46.0 && normalizedLon >= -5.0 && normalizedLon <= 36.0) {
      if ((lat > 40.0 && normalizedLon > 0.0 && normalizedLon < 20.0) || (lat > 36.0 && normalizedLon < -3.0)) {
        return true;
      }
      return false;
    }
    // Exclude Black Sea
    if (lat >= 41.0 && lat <= 47.0 && normalizedLon >= 27.5 && normalizedLon <= 41.5) return false;
    // Exclude Baltic Sea
    if (lat >= 54.0 && lat <= 66.0 && normalizedLon >= 14.0 && normalizedLon <= 30.0) return false;
    // Exclude Caspian Sea
    if (lat >= 36.5 && lat <= 47.5 && normalizedLon >= 46.5 && normalizedLon <= 54.5) return false;
    return true;
  }

  // South Asia & East Asia & Southeast Asia (India, Nepal, China, Indochina, Arabia)
  if (lat >= 1.0 && lat <= 35.0 && normalizedLon >= 34.0 && normalizedLon <= 135.0) {
    // Exclude Arabian Sea
    if (lat >= 1.0 && lat <= 24.0 && normalizedLon >= 55.0 && normalizedLon <= 72.0) {
      if (lat < 20.0) return false;
    }
    // Exclude Bay of Bengal
    if (lat >= 1.0 && lat <= 22.0 && normalizedLon >= 80.0 && normalizedLon <= 93.0) {
      if (lat < 18.0) return false;
    }
    // Exclude South China Sea deep basin
    if (lat >= 5.0 && lat <= 19.0 && normalizedLon >= 110.0 && normalizedLon <= 118.0) {
      return false;
    }
    return true;
  }

  // Africa
  if (lat >= -35.0 && lat <= 37.0 && normalizedLon >= -18.0 && normalizedLon <= 52.0) {
    // Exclude Red Sea
    if (lat >= 12.0 && lat <= 30.0 && normalizedLon >= 32.0 && normalizedLon <= 44.0) {
      if (normalizedLon > 36.0 && normalizedLon < 42.0) return false;
    }
    return true;
  }

  // Australia & New Zealand & Papua New Guinea
  if (lat >= -48.0 && lat <= -9.0 && normalizedLon >= 112.0 && normalizedLon <= 179.0) {
    return true;
  }

  // Maritime Southeast Asia / Japan / UK / Madagascar
  if (lat >= -11.0 && lat <= 20.0 && normalizedLon >= 95.0 && normalizedLon <= 142.0) return true; // Indonesia, Philippines
  if (lat >= 30.0 && lat <= 46.0 && normalizedLon >= 128.0 && normalizedLon <= 146.0) return true; // Japan
  if (lat >= 50.0 && lat <= 59.0 && normalizedLon >= -11.0 && normalizedLon <= 2.0) return true; // Great Britain & Ireland
  if (lat >= -26.0 && lat <= -11.0 && normalizedLon >= 43.0 && normalizedLon <= 51.0) return true; // Madagascar

  return false;
}

/**
 * Computes deterministic, continuous spherical harmonic noise for fine-grained terrain micro-elevation.
 */
function getSphericalMicroVariation(lat: number, lon: number): number {
  const radLat = (lat * Math.PI) / 180.0;
  const radLon = (lon * Math.PI) / 180.0;

  const nx = Math.cos(radLat) * Math.sin(radLon);
  const ny = Math.sin(radLat);
  const nz = Math.cos(radLat) * Math.cos(radLon);

  // Multi-frequency harmonic synthesis
  let v = Math.sin(nx * 12.5 + ny * 8.7) * Math.cos(nz * 14.3);
  v += 0.5 * Math.sin(nx * 25.1 + nz * 18.2) * Math.cos(ny * 22.4);
  v += 0.25 * Math.sin(ny * 48.3 + nx * 37.1) * Math.cos(nz * 51.2);
  v += 0.125 * Math.sin(nz * 96.7 + ny * 82.5) * Math.cos(nx * 88.3);

  return v / 1.875; // Normalized to [-1.0 .. 1.0]
}

/**
 * Calculates estimated terrain elevation in meters above/below mean sea level.
 * Features realistic orographic heights, continental plains, abyssal oceanic trenches, and smooth coastlines.
 */
export function getEstimatedElevation(
  lat: number,
  lon: number
): {
  elevationMeters: number;
  normalizedElevation: number;
  terrainType: TerrainType;
  isLand: boolean;
  description: string;
} {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      elevationMeters: 0,
      normalizedElevation: 0.554,
      terrainType: 'ocean',
      isLand: false,
      description: 'Oceanic OCEAN',
    };
  }

  let normalizedLon = ((lon + 180) % 360) - 180;
  if (normalizedLon === 180) normalizedLon = -180;

  const micro = getSphericalMicroVariation(lat, lon);

  // 1. Evaluate Oceanic Trench Bathymetry first
  let trenchDepth = 0;
  let trenchName = '';
  for (const trench of MAJOR_OCEANIC_TRENCHES) {
    const dLat = lat - trench.lat;
    const dLon = ((lon - trench.lon + 540) % 360) - 180;
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);
    if (dist < trench.radiusDeg) {
      const factor = 1.0 - dist / trench.radiusDeg;
      const depth = trench.depthMeters * Math.pow(factor, 2.0);
      if (depth < trenchDepth) {
        trenchDepth = depth;
        trenchName = trench.name;
      }
    }
  }

  let isLand = isGeographicLand(lat, lon);
  // Override isLand if inside an oceanic trench radius
  if (trenchDepth < 0) {
    isLand = false;
  }

  let elevationMeters = 0;
  let regionName = '';

  if (isLand) {
    // Check for major mountain ranges
    let mountainBoost = 0;
    for (const region of MAJOR_MOUNTAIN_REGIONS) {
      if (lat >= region.minLat && lat <= region.maxLat) {
        const inLon =
          region.minLon <= region.maxLon
            ? normalizedLon >= region.minLon && normalizedLon <= region.maxLon
            : normalizedLon >= region.minLon || normalizedLon <= region.maxLon;

        if (inLon) {
          // Distance to peak center with antimeridian longitude wrapping
          const dLat = lat - region.peakLat;
          const dLon = ((lon - region.peakLon + 540) % 360) - 180;
          const dist = Math.sqrt(dLat * dLat + dLon * dLon);
          const maxDist = Math.max(
            region.maxLat - region.minLat,
            Math.abs(region.maxLon - region.minLon)
          );
          const proximityFactor = Math.max(0.0, 1.0 - dist / (maxDist * 0.7));

          const rangeElev =
            region.baseElev +
            (region.peakElev - region.baseElev) * Math.pow(proximityFactor, 1.5);
          if (rangeElev > mountainBoost) {
            mountainBoost = rangeElev;
            regionName = region.name;
          }
        }
      }
    }

    if (mountainBoost > 0) {
      elevationMeters = Math.min(8848.0, mountainBoost + micro * 150.0);
    } else {
      // General continental plains / hills
      const baseContinental = 280.0;
      elevationMeters = Math.max(5.0, baseContinental + micro * 220.0);
    }
  } else {
    // Oceanic Bathymetry
    if (trenchDepth < 0) {
      elevationMeters = Math.max(-11034.0, trenchDepth + micro * 300.0);
      regionName = trenchName;
    } else {
      // Abyssal plain / ocean basin with mid-ocean ridge bathymetry
      const baseAbyssal = -3800.0;
      elevationMeters = baseAbyssal + micro * 1200.0;
    }
  }

  elevationMeters = Math.max(-11034, Math.min(8848, Math.round(elevationMeters)));

  // Classify terrain type
  const terrainType = classifyTerrain(lat, lon, elevationMeters);

  // Normalized elevation: Map full Earth range [-11,000m .. 8,848m] to [0.0 .. 1.0]
  // Deepest trench (-11,000m) -> 0.0, Sea level (0m) -> 0.554, Everest (8,848m) -> 1.0
  const normalizedElevation = Math.max(
    0.0,
    Math.min(1.0, (elevationMeters + 11000.0) / (8848.0 + 11000.0))
  );

  const description = regionName
    ? `${regionName} (${terrainType.toUpperCase()})`
    : `${isLand ? 'Terrestrial' : 'Oceanic'} ${terrainType.toUpperCase()}`;

  return {
    elevationMeters,
    normalizedElevation: parseFloat(normalizedElevation.toFixed(4)),
    terrainType,
    isLand,
    description,
  };
}

/**
 * Classifies geographic terrain into tactical topographical categories.
 */
export function classifyTerrain(
  lat: number,
  lon: number,
  elevationMeters?: number
): TerrainType {
  const elev =
    elevationMeters !== undefined
      ? elevationMeters
      : getEstimatedElevation(lat, lon).elevationMeters;

  if (elev < 0) {
    return 'ocean';
  } else if (elev < 40) {
    return 'coastal';
  } else if (elev < 450) {
    return 'plains';
  } else if (elev < 1500) {
    return 'hills';
  } else if (elev < 3500) {
    return 'mountains';
  } else {
    return 'high_plateau';
  }
}
