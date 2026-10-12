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
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureSpotsTable();
  await ensureFeedColumns();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const spots = await listSpots(me.id);
  const spot = spots.find((s) => s.id === params.id);
  if (!spot) return notFound("Spot not found.");

  // Optional composer payload: the sharer's own text, photos and video.
  let caption = "";
  let photos: string[] = [];
  let video: { playback_id: string; duration: number | null } | null = null;
  try {
    const payload = (await req.json()) as Record<string, unknown>;
    if (typeof payload.caption === "string") {
      caption = payload.caption.trim().slice(0, 1000);
    }
    if (Array.isArray(payload.photos)) {
      photos = payload.photos
        .filter(
          (u): u is string =>
            typeof u === "string" && /^https?:\/\//.test(u) && u.length <= 2048
        )
        .slice(0, 4);
    }
    const v = payload.video as { playback_id?: unknown; duration?: unknown } | null;
    if (v && typeof v.playback_id === "string" && v.playback_id.length <= 128) {
      video = {
        playback_id: v.playback_id,
        duration: typeof v.duration === "number" && Number.isFinite(v.duration) ? v.duration : null,
      };
    }
  } catch {
    // No body — a plain share with the standard text.
  }

  const body = caption
    ? `${caption}\n\n📍 ${spot.name || "Fishing spot"} — tap to view it on the map, and save a copy to your own spots! 🎣`
    : `📍 ${me.name} shared a fishing spot: ${spot.name || "Fishing spot"}\n\n` +
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
    `INSERT INTO fm_discussions (user_id, body, kind, photo_url, photos, video, visibility, spot_share)
     VALUES ($1, $2, 'post', $3, $4::jsonb, $5::jsonb, 'friends', $6::jsonb)
     RETURNING id`,
    [
      me.id,
      body,
      photos[0] ?? null,
      JSON.stringify(photos),
      video ? JSON.stringify(video) : null,
      JSON.stringify(spotShare),
    ]
  );
  return NextResponse.json({ post_id: rows[0]?.id ?? null }, { status: 201 });
}
