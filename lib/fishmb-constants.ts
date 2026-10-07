/** Client-safe FishMB constants (no node imports). */

export const LAKE_REGIONS = [
  "Eastern",
  "Interlake",
  "Northern",
  "Parkland",
  "Southern",
  "Western",
] as const;

/**
 * Verified lake/fishing photos (each one visually checked — no stock-photo
 * roulette). The lake records' picsum URLs resolve to unrelated subjects
 * (buildings, cafes), so cards and heroes use this pool instead, picked
 * deterministically per lake id.
 */
const LAKE_PHOTO_IDS = [
  "1439066615861-d1af74d74000", // wooden dock on a pine lake
  "1501785888041-af3ef285b470", // turquoise lake with boats
  "1476514525535-07fb3b4ae5f1", // wooden boat bow on a lake
  "1541742425281-c1d3fc8aff96", // fishing rods at sunset over water
  "1609859682240-6860cf3d99d5", // anglers fishing a green lake
] as const;

export function lakePhotoUrl(id: string, w = 800): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const photo = LAKE_PHOTO_IDS[h % LAKE_PHOTO_IDS.length];
  return `https://images.unsplash.com/photo-${photo}?auto=format&fit=crop&w=${w}&q=60`;
}

export const FISHMB_HERO_PHOTO =
  "https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=2000&q=70";

export const FISHMB_CTA_PHOTO =
  "https://images.unsplash.com/photo-1541742425281-c1d3fc8aff96?auto=format&fit=crop&w=1800&q=70";
