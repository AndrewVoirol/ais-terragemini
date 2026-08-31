import { Coordinates } from '../types';

const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;
const EARTH_RADIUS_KM = 6371.0;

/**
 * Projects geodetic coordinates (lat, lon) from spherical 3D space to 2D screen pixels.
 * Matches the WebGL shader's forward projection matrix and depth buffer calculation.
 *
 * @param lat Latitude in degrees [-90..90]
 * @param lon Longitude in degrees [-180..180]
 * @param rotation Camera spherical rotation [yaw, pitch] in degrees
 * @param scale Globe radius in pixels
 * @param center Canvas center coordinate { x, y } in pixels
 * @param altitude Optional normalized altitude offset (0 = surface)
 * @returns { x, y, depth, isVisible } Screen position, z-depth, and front-facing visibility flag
 */
export function projectSphereToScreen(
  lat: number,
  lon: number,
  rotation: [number, number],
  scale: number,
  center: { x: number; y: number },
  altitude: number = 0
): { x: number; y: number; depth: number; isVisible: boolean } {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !center ||
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y) ||
    !rotation ||
    !Number.isFinite(rotation[0]) ||
    !Number.isFinite(rotation[1])
  ) {
    return { x: 0, y: 0, depth: 0, isVisible: false };
  }

  const R = 1.0 + altitude;
  const latRad = lat * DEG2RAD;
  const lonRad = lon * DEG2RAD;

  const clat = Math.cos(latRad);
  const px = R * clat * Math.sin(lonRad);
  const py = R * Math.sin(latRad);
  const pz = R * clat * Math.cos(lonRad);

  // 1. Rotate around Y axis (yaw / longitude spin)
  const angleY = rotation[0] * DEG2RAD;
  const sY = Math.sin(angleY);
  const cY = Math.cos(angleY);
  const p1x = cY * px + sY * pz;
  const p1y = py;
  const p1z = -sY * px + cY * pz;

  // 2. Rotate around X axis (pitch / latitude tilt)
  const angleX = rotation[1] * DEG2RAD;
  const sX = Math.sin(angleX);
  const cX = Math.cos(angleX);
  const p2x = p1x;
  const p2y = cX * p1y - sX * p1z;
  const p2z = sX * p1y + cX * p1z;

  // Screen space transformation (Y inverted for canvas coordinates)
  const screenX = center.x + p2x * scale;
  const screenY = center.y - p2y * scale;

  return {
    x: screenX,
    y: screenY,
    depth: p2z,
    isVisible: p2z > 0.0,
  };
}

/**
 * Unprojects 2D screen coordinates back to 3D spherical surface coordinates via raycasting.
 * Returns null if the screen cursor ray misses the spherical globe.
 *
 * @param screenX Screen X coordinate in pixels
 * @param screenY Screen Y coordinate in pixels
 * @param rotation Camera spherical rotation [yaw, pitch] in degrees
 * @param scale Globe radius in pixels
 * @param center Canvas center coordinate { x, y } in pixels
 * @returns { lat, lon } or null if ray misses the globe
 */
export function unprojectScreenToSphere(
  screenX: number,
  screenY: number,
  rotation: [number, number],
  scale: number,
  center: { x: number; y: number }
): Coordinates | null {
  if (
    !Number.isFinite(screenX) ||
    !Number.isFinite(screenY) ||
    !Number.isFinite(scale) ||
    scale <= 0 ||
    !center ||
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y) ||
    !rotation ||
    !Number.isFinite(rotation[0]) ||
    !Number.isFinite(rotation[1])
  ) {
    return null;
  }

  const mx = screenX - center.x;
  const my = screenY - center.y;

  const rX = mx / scale;
  const rY = -my / scale; // Invert Y back to Cartesian space
  const rSq = rX * rX + rY * rY;

  // Ray misses the unit sphere or is non-finite
  if (!Number.isFinite(rSq) || rSq > 1.0) return null;

  const rZ = Math.sqrt(Math.max(0.0, 1.0 - rSq));

  // Inverse rotation: First inverse rotateX (-rotation[1]), then inverse rotateY (-rotation[0])
  const angleX = -rotation[1] * DEG2RAD;
  const sX = Math.sin(angleX);
  const cX = Math.cos(angleX);
  const p1x = rX;
  const p1y = cX * rY - sX * rZ;
  const p1z = sX * rY + cX * rZ;

  const angleY = -rotation[0] * DEG2RAD;
  const sY = Math.sin(angleY);
  const cY = Math.cos(angleY);
  const p2x = cY * p1x + sY * p1z;
  const p2y = p1y;
  const p2z = -sY * p1x + cY * p1z;

  const latRad = Math.asin(Math.max(-1.0, Math.min(1.0, p2y)));
  const lonRad = Math.atan2(p2x, p2z);

  const lat = latRad * RAD2DEG;
  const lon = lonRad * RAD2DEG;

  return { lat, lon };
}

/**
 * Computes great-circle distance between two geographic coordinates using the Haversine formula.
 * @returns Distance in kilometers
 */
export function getSphericalDistance(c1: Coordinates, c2: Coordinates): number {
  const lat1 = c1.lat * DEG2RAD;
  const lon1 = c1.lon * DEG2RAD;
  const lat2 = c2.lat * DEG2RAD;
  const lon2 = c2.lon * DEG2RAD;

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const a =
    Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0);

  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0.0, 1.0 - a)));
  return EARTH_RADIUS_KM * c;
}

/**
 * Computes the initial bearing / azimuth from coordinate A to coordinate B.
 * @returns Bearing in degrees [0, 360)
 */
export function getBearing(from: Coordinates, to: Coordinates): number {
  const lat1 = from.lat * DEG2RAD;
  const lon1 = from.lon * DEG2RAD;
  const lat2 = to.lat * DEG2RAD;
  const lon2 = to.lon * DEG2RAD;

  const dLon = lon2 - lon1;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const brng = Math.atan2(y, x) * RAD2DEG;
  return (brng + 360.0) % 360.0;
}

/**
 * Checks whether a given geographic coordinate is occluded by the back hemisphere of the rotating globe.
 */
export function isPointOccluded(
  lat: number,
  lon: number,
  rotation: [number, number]
): boolean {
  const proj = projectSphereToScreen(lat, lon, rotation, 1.0, { x: 0, y: 0 });
  return !proj.isVisible;
}

/**
 * Performs Spherical Linear Interpolation (Slerp) along the great circle arc between two points.
 * @param c1 Start coordinate
 * @param c2 End coordinate
 * @param t Interpolation fraction [0..1]
 */
export function interpolateGreatCircle(
  c1: Coordinates,
  c2: Coordinates,
  t: number
): Coordinates {
  const clampedT = Math.max(0.0, Math.min(1.0, t));
  const lat1 = c1.lat * DEG2RAD;
  const lon1 = c1.lon * DEG2RAD;
  const lat2 = c2.lat * DEG2RAD;
  const lon2 = c2.lon * DEG2RAD;

  // Convert to 3D Cartesian
  const p1 = [Math.cos(lat1) * Math.cos(lon1), Math.cos(lat1) * Math.sin(lon1), Math.sin(lat1)];
  const p2 = [Math.cos(lat2) * Math.cos(lon2), Math.cos(lat2) * Math.sin(lon2), Math.sin(lat2)];

  const dot = Math.max(-1.0, Math.min(1.0, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]));
  const omega = Math.acos(dot);

  if (Math.abs(omega) < 1e-6) {
    return { lat: c1.lat, lon: c1.lon };
  }

  const sinOmega = Math.sin(omega);
  const scale1 = Math.sin((1.0 - clampedT) * omega) / sinOmega;
  const scale2 = Math.sin(clampedT * omega) / sinOmega;

  const x = scale1 * p1[0] + scale2 * p2[0];
  const y = scale1 * p1[1] + scale2 * p2[1];
  const z = scale1 * p1[2] + scale2 * p2[2];

  const lat = Math.asin(Math.max(-1.0, Math.min(1.0, z))) * RAD2DEG;
  const lon = Math.atan2(y, x) * RAD2DEG;

  return { lat, lon };
}
