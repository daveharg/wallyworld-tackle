// /api/fishmb/favorite-lakes — the signed-in user's favorite lakes for quick
// map navigation on the profile's fishing-spots section.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
} from "@/lib/fish/auth";
import {
  listFavoriteLakes,
  addFavoriteLake,
} from "@/lib/fish/spots";
import { getLake } from "@/lib/fishmb";
import coordsJson from "@/public/fishmb/lake-coords.json";

const COORDS = coordsJson as Record<string, { lat: number; lng: number }>;

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const favs = await listFavoriteLakes(me.id);
  return NextResponse.json({
    lakes: favs
      .map((f) => {
        const lake = getLake(f.lake_id);
        const c = COORDS[f.lake_id];
        if (!lake) return null;
        return {
          id: lake.id,
          name: lake.name,
          region: lake.region,
          lat: c?.lat ?? null,
          lng: c?.lng ?? null,
          created_at: f.created_at,
        };
      })
      .filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const lakeId = typeof body.lake_id === "string" ? body.lake_id.trim() : "";
  if (!lakeId) return badRequest("lake_id is required.");
  if (!getLake(lakeId)) return badRequest("Unknown lake.");
  await addFavoriteLake(me.id, lakeId);
  return NextResponse.json({ ok: true });
}
