import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { query } from "@/lib/fish/db";

export const dynamic = "force-dynamic";

// GET /api/fishmb/map-catches?lat=&lng=&radius_km=&mine=1
// GPS catches for the maps page:
//   - mine=1 → the signed-in user's own catches that have GPS (any visibility).
//   - all=1 → every catch the viewer may see (own + public + friends'),
//     province-wide, no radius — feeds the Catches tab's All/Friends lists.
//   - otherwise → public catches (plus friends' + own, same rules as the feed)
//     with GPS inside radius_km of the given point.
// Exact coordinates are only returned for catches the viewer may already see
// in the feed; private catches never appear here.
export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  // The depth column is selected below — make sure it exists (self-applying
  // migration, same pattern as the catches routes).
  try {
    await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS depth_ft numeric(6,1)`);
  } catch {}

  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radiusKm = Math.min(
    Math.max(Number(url.searchParams.get("radius_km")) || 40, 1),
    500
  );
  const mineOnly = url.searchParams.get("mine") === "1";
  // all=1 → every catch the viewer may see, province-wide (no radius).
  // Used by the Catches tab's "All" list; map pins keep the radius query.
  const allMode = url.searchParams.get("all") === "1" && !mineOnly;

  if (!allMode && (!Number.isFinite(lat) || !Number.isFinite(lng))) {
    return NextResponse.json(
      { error: "lat and lng query params are required." },
      { status: 400 }
    );
  }

  // Rough bounding box pre-filter (1° lat ≈ 111 km).
  const dLat = radiusKm / 111;
  const dLng = radiusKm / Math.max(Math.cos((lat * Math.PI) / 180), 0.2);

  // GPS columns are added lazily by the catch composer; ensure they exist.
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS lat double precision`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS lng double precision`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS share_location boolean DEFAULT true`);

  let visibilityWhere: string;
  const params: unknown[] = allMode
    ? [me.id]
    : [me.id, lat - dLat, lat + dLat, lng - dLng, lng + dLng];
  if (mineOnly) {
    visibilityWhere = `c.user_id = $1`;
  } else {
    // Other anglers' catches only appear when they chose to share the location.
    visibilityWhere = `(
      c.user_id = $1
      OR (
        COALESCE(c.share_location, true) = true
        AND (
          c.visibility = 'public'
          OR (c.visibility = 'friends' AND EXISTS (
                SELECT 1 FROM fm_friendships f
                 WHERE f.status = 'accepted'
                   AND ((f.requester_id = $1 AND f.addressee_id = c.user_id)
                     OR (f.addressee_id = $1 AND f.requester_id = c.user_id))
              ))
        )
      )
    )`;
  }

  const rows = await query<{
    id: string;
    user_id: string;
    species: string;
    length_in: string;
    weight_lb: string | null;
    depth_ft: string | null;
    photo_url: string | null;
    lat: number;
    lng: number;
    caught_at: string;
    user_name: string;
    is_friend: boolean;
  }>(
    `SELECT c.id, c.user_id, c.species, c.length_in, c.weight_lb, c.depth_ft,
            COALESCE(c.photo_hold_url, c.photo_measure_url) AS photo_url,
            c.lat, c.lng, c.caught_at, u.name AS user_name,
            u.avatar_url AS avatar_url,
            EXISTS (
              SELECT 1 FROM fm_friendships f
               WHERE f.status = 'accepted'
                 AND ((f.requester_id = $1 AND f.addressee_id = c.user_id)
                   OR (f.addressee_id = $1 AND f.requester_id = c.user_id))
            ) AS is_friend
       FROM fm_catches c
       JOIN fm_users u ON u.id = c.user_id
      WHERE ${visibilityWhere}
        AND c.lat IS NOT NULL AND c.lng IS NOT NULL
        ${allMode ? "" : "AND c.lat BETWEEN $2 AND $3 AND c.lng BETWEEN $4 AND $5"}
      ORDER BY c.caught_at DESC
      LIMIT ${allMode ? 1000 : 200}`,
    params
  );

  // Haversine filter to the true radius.
  const toRad = (d: number) => (d * Math.PI) / 180;
  const distKm = (a: number, b: number) => {
    const s =
      Math.sin(toRad((a - lat) / 2)) ** 2 +
      Math.cos(toRad(lat)) * Math.cos(toRad(a)) *
        Math.sin(toRad((b - lng) / 2)) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(s));
  };

  const catches = rows
    .filter((r) => allMode || distKm(r.lat, r.lng) <= radiusKm)
    .map((r) => ({
      id: r.id,
      species: r.species,
      length_in: Number(r.length_in),
      weight_lb: r.weight_lb === null ? null : Number(r.weight_lb),
      depth_ft: r.depth_ft === null || r.depth_ft === undefined ? null : Number(r.depth_ft),
      photo_url: r.photo_url,
      lat: r.lat,
      lng: r.lng,
      caught_at: r.caught_at,
      user_name: r.user_name,
      avatar_url: (r as any).avatar_url ?? null,
      mine: r.user_id === me.id,
      friend: r.user_id !== me.id && !!r.is_friend,
    }));

  return NextResponse.json({ catches });
}
