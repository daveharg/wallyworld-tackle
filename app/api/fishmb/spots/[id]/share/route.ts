// /api/fishmb/spots/[id]/share — share one of the signed-in user's fishing
// spots to the community feed. Friends can view it on the map and save a
// copy to their own spots. Owner-scoped: only the spot owner can share it.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  notFound,
} from "@/lib/fish/auth";
import { ensureSpotsTable, listSpots } from "@/lib/fish/spots";
import { ensureFeedColumns } from "@/lib/fish/feed";
import { query } from "@/lib/fish/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureSpotsTable();
  await ensureFeedColumns();
  const me = await fishUserFromRequest(_req);
  if (!me) return unauthorized();
  const spots = await listSpots(me.id);
  const spot = spots.find((s) => s.id === params.id);
  if (!spot) return notFound("Spot not found.");

  const body =
    `📍 ${me.name} shared a fishing spot: ${spot.name || "Fishing spot"}\n\n` +
    (spot.notes ? `${spot.notes}\n\n` : "") +
    `Tap to view it on the map — and save a copy to your own spots! 🎣`;

  const spotShare = {
    name: spot.name || "Fishing spot",
    lat: Number(spot.lat),
    lng: Number(spot.lng),
    notes: spot.notes || "",
    icon: spot.icon || "pin",
  };

  const rows = await query(
    `INSERT INTO fm_discussions (user_id, body, kind, visibility, spot_share)
     VALUES ($1, $2, 'post', 'friends', $3::jsonb)
     RETURNING id`,
    [me.id, body, JSON.stringify(spotShare)]
  );
  return NextResponse.json({ post_id: rows[0]?.id ?? null }, { status: 201 });
}
