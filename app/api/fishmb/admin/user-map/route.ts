// GET /api/fishmb/admin/user-map — where FishMB anglers are active, aggregated
// into geographic grid cells for tournament planning. Admin only.
//
// PRIVACY: this endpoint returns ONLY aggregated cells (center + angler count +
// pin count). It never exposes individual user identities, names, or exact
// spot coordinates — private spots stay private.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized, forbidden } from "@/lib/fish/auth";
import { isAdminEmail } from "@/lib/fish/business";
import { ensureSpotsTable } from "@/lib/fish/spots";

export interface MapCell {
  lat: number;
  lng: number;
  anglers: number;
  pins: number;
}

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!isAdminEmail(me.email)) return forbidden("Admin only.");
  await ensureSpotsTable();

  // Grid size in degrees (~0.15° ≈ 11km E-W / 17km N-S in Manitoba).
  const GRID = 0.15;

  // Combine fishing spots and geo-tagged catches into one anonymized point set.
  const rows = await query<{ lat: number; lng: number; user_id: string }>(
    `SELECT lat, lng, user_id::text AS user_id FROM fm_fishing_spots
     UNION ALL
     SELECT lat, lng, user_id::text AS user_id FROM fm_catches
     WHERE lat IS NOT NULL AND lng IS NOT NULL`
  );

  const cells = new Map<string, { latSum: number; lngSum: number; users: Set<string>; pins: number }>();
  for (const r of rows) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) continue;
    if (r.lat < -90 || r.lat > 90 || r.lng < -180 || r.lng > 180) continue;
    const key = `${Math.floor(r.lat / GRID)}:${Math.floor(r.lng / GRID)}`;
    let cell = cells.get(key);
    if (!cell) {
      cell = { latSum: 0, lngSum: 0, users: new Set(), pins: 0 };
      cells.set(key, cell);
    }
    cell.latSum += r.lat;
    cell.lngSum += r.lng;
    cell.users.add(r.user_id);
    cell.pins += 1;
  }

  const result: MapCell[] = [];
  for (const cell of Array.from(cells.values())) {
    // Only show cells with at least 2 distinct anglers — a single user's
    // private spots must never be identifiable on the admin map.
    if (cell.users.size < 2) continue;
    result.push({
      lat: cell.latSum / cell.pins,
      lng: cell.lngSum / cell.pins,
      anglers: cell.users.size,
      pins: cell.pins,
    });
  }
  result.sort((a, b) => b.anglers - a.anglers);

  return NextResponse.json({
    cells: result,
    totalAnglers: new Set(rows.map((r) => r.user_id)).size,
    totalPins: rows.length,
  });
}
