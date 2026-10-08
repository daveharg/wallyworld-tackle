// /api/fishmb/spots — the signed-in user's own fishing spots (private).
// GET lists them; POST creates one.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
} from "@/lib/fish/auth";
import {
  ensureSpotsTable,
  listSpots,
  createSpot,
  isValidLat,
  isValidLng,
} from "@/lib/fish/spots";

export async function GET(req: NextRequest) {
  await ensureSpotsTable();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const spots = await listSpots(me.id);
  return NextResponse.json({ spots });
}

export async function POST(req: NextRequest) {
  await ensureSpotsTable();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const lat = typeof body.lat === "string" ? Number(body.lat) : body.lat;
  const lng = typeof body.lng === "string" ? Number(body.lng) : body.lng;
  if (!isValidLat(lat)) return badRequest("lat must be a number between -90 and 90.");
  if (!isValidLng(lng)) return badRequest("lng must be a number between -180 and 180.");
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, 80)
      : "Fishing spot";
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim().slice(0, 500)
      : null;
  const spot = await createSpot(me.id, { name, lat, lng, notes });
  return NextResponse.json({ spot }, { status: 201 });
}
