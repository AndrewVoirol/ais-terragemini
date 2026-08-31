import { Coordinates, FormattedCoordinates } from '../types';

/**
 * WGS84 Ellipsoid Reference Constants
 */
const WGS84_A = 6378137.0; // Semi-major axis in meters
const WGS84_F = 1.0 / 298.257223563; // Flattening factor
const WGS84_B = WGS84_A * (1.0 - WGS84_F); // Semi-minor axis in meters (6356752.314245)
const WGS84_E2 = 2.0 * WGS84_F - WGS84_F * WGS84_F; // First eccentricity squared (~0.00669437999014)
const WGS84_E_PRIME2 = WGS84_E2 / (1.0 - WGS84_E2); // Second eccentricity squared (~0.00673949674228)
const UTM_K0 = 0.9996; // Central scale factor

/**
 * MGRS 100,000-meter column identification letters (A-Z omitting I and O).
 * Grouped into 3 repeating column sets across the 60 UTM zones.
 */
const MGRS_COL_SETS: readonly string[] = [
  'ABCDEFGH', // Set 1 (zones 1, 4, 7, ..., 58)
  'JKLMNPQR', // Set 2 (zones 2, 5, 8, ..., 59)
  'STUVWXYZ', // Set 3 (zones 3, 6, 9, ..., 60)
];

/**
 * MGRS 100,000-meter row identification letters (A-V omitting I and O, 20 letters).
 */
const MGRS_ROW_LETTERS = 'ABCDEFGHJKLMNPQRSTUV';

/**
 * Latitude bands (8-degree increments from 80°S to 84°N, omitting I and O).
 */
const LATITUDE_BANDS = 'CDEFGHJKLMNPQRSTUVWX';

/**
 * Determines the UTM zone number (1-60) for a given longitude and latitude,
 * including standard military exceptions for Norway and Svalbard.
 */
export function getUTMZone(lat: number, lon: number): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return 1;
  }

  let normalizedLon = ((lon + 180) % 360) - 180;
  if (normalizedLon === 180) normalizedLon = -180;

  // Base zone calculation
  let zone = Math.floor((normalizedLon + 180) / 6) + 1;
  if (zone < 1) zone = 1;
  if (zone > 60) zone = 60;

  // Special handling for Norway (Band V)
  if (lat >= 56.0 && lat < 64.0 && normalizedLon >= 3.0 && normalizedLon < 12.0) {
    zone = 32;
  }

  // Special handling for Svalbard (Band X)
  if (lat >= 72.0 && lat < 84.0) {
    if (normalizedLon >= 0.0 && normalizedLon < 9.0) zone = 31;
    else if (normalizedLon >= 9.0 && normalizedLon < 21.0) zone = 33;
    else if (normalizedLon >= 21.0 && normalizedLon < 33.0) zone = 35;
    else if (normalizedLon >= 33.0 && normalizedLon < 42.0) zone = 37;
  }

  return zone;
}

/**
 * Determines the military latitude band letter (C-X) for a given latitude.
 */
export function getLatitudeBand(lat: number): string {
  if (!Number.isFinite(lat)) return '';
  if (lat < -80.0) return 'C';
  if (lat >= 84.0) return 'X';
  if (lat >= 72.0) return 'X'; // Band X is 12 degrees wide (72°N to 84°N)

  const index = Math.floor((lat + 80.0) / 8.0);
  const clampedIndex = Math.max(0, Math.min(19, index));
  return LATITUDE_BANDS.charAt(clampedIndex);
}

/**
 * Converts WGS84 Geodetic Latitude and Longitude to Universal Transverse Mercator (UTM).
 * Uses high-precision series expansions on the WGS84 reference ellipsoid.
 */
export function latLonToUTM(
  lat: number,
  lon: number
): { zoneNumber: number; band: string; easting: number; northing: number } {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { zoneNumber: 0, band: '', easting: 0, northing: 0 };
  }

  // Clamp latitude to valid UTM coverage (-80° to 84°)
  const clampedLat = Math.max(-80.0, Math.min(84.0, lat));
  const zoneNumber = getUTMZone(clampedLat, lon);
  const band = getLatitudeBand(clampedLat);

  const latRad = (clampedLat * Math.PI) / 180.0;
  const lonRad = (lon * Math.PI) / 180.0;

  // Central meridian for this UTM zone
  const centralLonRad = (((zoneNumber - 1) * 6 - 180 + 3) * Math.PI) / 180.0;
  const dLon = lonRad - centralLonRad;

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);

  const N = WGS84_A / Math.sqrt(1.0 - WGS84_E2 * sinLat * sinLat);
  const T = tanLat * tanLat;
  const C = WGS84_E_PRIME2 * cosLat * cosLat;
  const A = cosLat * dLon;

  // True distance along the central meridian from equator to latitude
  const M =
    WGS84_A *
    ((1.0 - WGS84_E2 / 4.0 - (3.0 * WGS84_E2 * WGS84_E2) / 64.0 - (5.0 * Math.pow(WGS84_E2, 3)) / 256.0) *
      latRad -
      ((3.0 * WGS84_E2) / 8.0 + (3.0 * WGS84_E2 * WGS84_E2) / 32.0 + (45.0 * Math.pow(WGS84_E2, 3)) / 1024.0) *
        Math.sin(2.0 * latRad) +
      ((15.0 * WGS84_E2 * WGS84_E2) / 256.0 + (45.0 * Math.pow(WGS84_E2, 3)) / 1024.0) *
        Math.sin(4.0 * latRad) -
      ((35.0 * Math.pow(WGS84_E2, 3)) / 3072.0) * Math.sin(6.0 * latRad));

  const A2 = A * A;
  const A3 = A2 * A;
  const A4 = A2 * A2;
  const A5 = A4 * A;
  const A6 = A3 * A3;

  // Easting (with 500,000m false easting)
  const easting =
    UTM_K0 *
      N *
      (A +
        ((1.0 - T + C) * A3) / 6.0 +
        ((5.0 - 18.0 * T + T * T + 72.0 * C - 58.0 * WGS84_E_PRIME2) * A5) / 120.0) +
    500000.0;

  // Northing (with 10,000,000m false northing in Southern Hemisphere)
  let northing =
    UTM_K0 *
    (M +
      N *
        tanLat *
        (A2 / 2.0 +
          ((5.0 - T + 9.0 * C + 4.0 * C * C) * A4) / 24.0 +
          ((61.0 - 58.0 * T + T * T + 600.0 * C - 330.0 * WGS84_E_PRIME2) * A6) / 720.0));

  if (clampedLat < 0.0) {
    northing += 10000000.0; // Southern hemisphere false northing
  }

  return {
    zoneNumber,
    band,
    easting,
    northing,
  };
}

/**
 * Converts WGS84 Geodetic coordinates to standard Military Grid Reference System (MGRS).
 * Precision specifies the number of digits per coordinate component (1 to 5, default 5 = 10 digits, 1m precision).
 * Example for NYC: "18T WL 83959 07350"
 */
export function latLonToMGRS(lat: number, lon: number, precision: number = 5): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return '';
  }

  const utm = latLonToUTM(lat, lon);
  if (utm.zoneNumber === 0 || !utm.band) {
    return '';
  }

  const clampedPrecision = Math.max(0, Math.min(5, Math.floor(precision)));

  // Determine 100,000m column letter
  const setIndex = (utm.zoneNumber - 1) % 3;
  const colIndex = Math.floor(utm.easting / 100000.0) - 1;
  const colLetter = MGRS_COL_SETS[setIndex].charAt(Math.max(0, Math.min(7, colIndex)));

  // Determine 100,000m row letter (DoD/NGA standard row offset is 5 for even zones, 0 for odd zones)
  const rowOffset = utm.zoneNumber % 2 === 0 ? 5 : 0;
  const rowIndex = (Math.floor((utm.northing % 2000000.0) / 100000.0) + rowOffset) % 20;
  const rowLetter = MGRS_ROW_LETTERS.charAt(rowIndex);

  if (clampedPrecision === 0) {
    return `${utm.zoneNumber}${utm.band} ${colLetter}${rowLetter}`;
  }

  // Remainder meters within the 100k square
  const eastingRemainder = Math.floor(utm.easting % 100000.0);
  const northingRemainder = Math.floor(utm.northing % 100000.0);

  const divisor = Math.pow(10, 5 - clampedPrecision);
  const eastingStr = Math.floor(eastingRemainder / divisor)
    .toString()
    .padStart(clampedPrecision, '0');
  const northingStr = Math.floor(northingRemainder / divisor)
    .toString()
    .padStart(clampedPrecision, '0');

  return `${utm.zoneNumber}${utm.band} ${colLetter}${rowLetter} ${eastingStr} ${northingStr}`;
}

/**
 * Formats coordinates in high-precision Decimal Degrees (DD) with cardinal directions.
 * Example: "40.712800° N, 74.006000° W"
 */
export function latLonToDD(lat: number, lon: number, precision: number = 6): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return '';
  }

  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  const absLat = Math.abs(lat).toFixed(precision);
  const absLon = Math.abs(lon).toFixed(precision);
  return `${absLat}° ${latDir}, ${absLon}° ${lonDir}`;
}

/**
 * Formats coordinates in Degrees, Minutes, Seconds (DMS) with sub-second precision.
 * Example: 40° 42' 46.1" N, 74° 00' 21.6" W
 */
export function latLonToDMS(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return '';
  }

  const formatComponent = (val: number, isLat: boolean) => {
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
    const absVal = Math.abs(val);
    const deg = Math.floor(absVal);
    const minFloat = (absVal - deg) * 60.0;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60.0).toFixed(1);

    const padDeg = isLat ? deg.toString().padStart(2, '0') : deg.toString().padStart(3, '0');
    const padMin = min.toString().padStart(2, '0');
    const padSec = parseFloat(sec) < 10 ? `0${sec}` : sec;

    return `${padDeg}° ${padMin}' ${padSec}" ${dir}`;
  };

  return `${formatComponent(lat, true)}, ${formatComponent(lon, false)}`;
}

/**
 * Formats a UTM object into a standard tactical readout string.
 * Example: "18T 583959m E 4507350m N"
 */
export function formatUTM(utm: {
  zoneNumber: number;
  band: string;
  easting: number;
  northing: number;
}): string {
  if (!utm || utm.zoneNumber === 0 || !utm.band) {
    return '';
  }
  const e = Math.round(utm.easting);
  const n = Math.round(utm.northing);
  return `${utm.zoneNumber}${utm.band} ${e}m E ${n}m N`;
}

/**
 * Formats an MGRS string cleanly.
 */
export function formatMGRS(mgrs: string): string {
  return mgrs.trim();
}

/**
 * Formats Decimal Degrees cleanly.
 */
export function formatDD(lat: number, lon: number): string {
  return latLonToDD(lat, lon, 6);
}

/**
 * Formats Degrees Minutes Seconds cleanly.
 */
export function formatDMS(lat: number, lon: number): string {
  return latLonToDMS(lat, lon);
}

/**
 * Generates military tactical sector code from coordinates.
 * Example: "SEC-18T-WL"
 */
export function getSectorGridCode(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return '';
  }

  const utm = latLonToUTM(lat, lon);
  if (utm.zoneNumber === 0 || !utm.band) {
    return '';
  }

  const setIndex = (utm.zoneNumber - 1) % 3;
  const colIndex = Math.floor(utm.easting / 100000.0) - 1;
  const colLetter = MGRS_COL_SETS[setIndex].charAt(Math.max(0, Math.min(7, colIndex)));

  const rowOffset = utm.zoneNumber % 2 === 0 ? 5 : 0;
  const rowIndex = (Math.floor((utm.northing % 2000000.0) / 100000.0) + rowOffset) % 20;
  const rowLetter = MGRS_ROW_LETTERS.charAt(rowIndex);

  return `SEC-${utm.zoneNumber}${utm.band}-${colLetter}${rowLetter}`;
}

/**
 * Converts raw WGS84 latitude/longitude into all 4 standard tactical representations simultaneously.
 */
export function formatCoordinatesAll(lat: number, lon: number): FormattedCoordinates {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return {
      dd: '',
      dms: '',
      utm: '',
      mgrs: '',
      raw: { lat, lon },
    };
  }

  const utmObj = latLonToUTM(lat, lon);
  return {
    dd: latLonToDD(lat, lon, 6),
    dms: latLonToDMS(lat, lon),
    utm: formatUTM(utmObj),
    mgrs: latLonToMGRS(lat, lon, 5),
    raw: { lat, lon },
  };
}
