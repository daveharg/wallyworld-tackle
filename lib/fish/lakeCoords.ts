// Nearest-lake lookup from a GPS point, using the same lake centroid data
// the client loads from /fishmb/lake-coords.json (bundled here so the
// server can auto-assign a lake to every fishing spot).

import coordsJson from "@/public/fishmb/lake-coords.json";

interface LakeCoord {
  lat: number;
  lng: number;
  name: string;
}

const COORDS = coordsJson as unknown as Record<string, LakeCoord>;

function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const s =
    Math.sin(toRad((lat2 - lat1) / 2)) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad((lng2 - lng1) / 2)) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

/**
 * The lake a point belongs to: nearest lake centroid within maxKm
 * (default 30 km — big Manitoba lakes have distant centroids), else null.
 */
export function nearestLake(
  lat: number,
  lng: number,
  maxKm = 30
): { id: string; name: string; km: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  let best: { id: string; name: string; km: number } | null = null;
  for (const [id, c] of Object.entries(COORDS)) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    const km = kmBetween(lat, lng, c.lat, c.lng);
    if (km <= maxKm && (!best || km < best.km)) {
      best = { id, name: c.name, km };
    }
  }
  return best;
}
