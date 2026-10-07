// /api/fishmb/feed — community feed (same DB as the app).
// GET: latest posts + catches the viewer may see (public + friends-only for
// friends). POST: new discussion (auth), optional visibility + species_tag.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { getFeed, createPost } from "@/lib/fish/feed";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10) || 30, 50);
  const offset = parseInt(searchParams.get("offset") || "0", 10) || 0;
  let viewerId: string | null = null;
  try {
    const me = await fishUserFromRequest(req);
    viewerId = me ? me.id : null;
  } catch {
    // guests see public items only
  }
  const items = await getFeed(limit, offset, viewerId);
  return NextResponse.json({ items });
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
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
  if (!text) return badRequest("Write something first.");
  const photoUrl =
    typeof body.photo_url === "string" && /^https?:\/\//.test(body.photo_url)
      ? body.photo_url
      : null;
  const visibility = body.visibility === "friends" ? "friends" : "public";
  const speciesTag =
    typeof body.species_tag === "string" && body.species_tag.trim()
      ? body.species_tag.trim().slice(0, 60)
      : null;
  const item = await createPost(me.id, text, photoUrl, visibility, speciesTag);
  return NextResponse.json({ item }, { status: 201 });
}
