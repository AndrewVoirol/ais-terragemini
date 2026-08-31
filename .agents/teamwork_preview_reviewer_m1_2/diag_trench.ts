import { getEstimatedElevation, isGeographicLand } from '../../utils/elevation';

const trenches = [
  { name: 'Mariana Trench', lat: 11.3733, lon: 142.1989 },
  { name: 'Tonga Trench', lat: -23.2833, lon: -174.75 },
  { name: 'Philippine Trench', lat: 10.1, lon: 126.7 },
  { name: 'Kurile-Kamchatka Trench', lat: 45.0, lon: 153.0 },
  { name: 'Puerto Rico Trench', lat: 19.7, lon: -66.5 },
  { name: 'Java Trench', lat: -10.3, lon: 109.9 },
];

for (const t of trenches) {
  const isLand = isGeographicLand(t.lat, t.lon);
  const elev = getEstimatedElevation(t.lat, t.lon);
  console.log(`${t.name} (${t.lat}, ${t.lon}): isLand=${isLand}, elev=${elev.elevationMeters}m, type=${elev.terrainType}`);
}
