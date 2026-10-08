// /api/fishmb/feed — community feed (same DB as the app).
// GET: latest posts + catches the viewer may see (public + friends-only for
// friends). Optional ?q= searches body, species and author name.
// POST: new discussion (auth), optional visibility + species_tag + up to 4 photos.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { getFeed, createPost } from "@/lib/fish/feed";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 50);
  const kindParam = searchParams.get("kind");
  const kind: "all" | "catch" | "post" =
    kindParam === "catch" || kindParam === "post" ? kindParam : "all";
  const q = (searchParams.get("q") || "").trim().slice(0, 80) || null;
  const cursor = decodeCursor(searchParams.get("cursor"));
  let viewerId: string | null = null;
  try {
    const me = await fishUserFromRequest(req);
    viewerId = me ? me.id : null;
  } catch {
    // guests see public items only
  }
  const { items, hasMore } = await getFeed({ limit, viewerId, q, kind, cursor });
  return NextResponse.json({
    items,
    hasMore,
    nextCursor: items.length > 0 ? encodeCursor(items[items.length - 1]) : null,
  });
}

function encodeCursor(item: { created_at: string; id: string }): string {
  const iso = new Date(item.created_at).toISOString();
  return Buffer.from(`${iso}|${item.id}`, "utf8").toString("base64url");
}

function decodeCursor(raw: string | null): { before: string; beforeId: string } | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.lastIndexOf("|");
    if (sep < 0) return null;
    const before = decoded.slice(0, sep);
    const beforeId = decoded.slice(sep + 1);
    if (!before || !beforeId || Number.isNaN(Date.parse(before))) return null;
    return { before, beforeId };
  } catch {
    return null;
  }
}

function cleanUrl(v: unknown): string | null {
  return typeof v === "string" && /^https?:\/\//.test(v) ? v : null;
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
  const photoUrl = cleanUrl(body.photo_url);
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .map(cleanUrl)
    .filter((u): u is string => u !== null)
    .slice(0, 4);
  const visibility = body.visibility === "friends" ? "friends" : "public";
  const speciesTag =
    typeof body.species_tag === "string" && body.species_tag.trim()
      ? body.species_tag.trim().slice(0, 60)
      : null;
  const item = await createPost(me.id, text, photoUrl, visibility, speciesTag, photos);
  return NextResponse.json({ item }, { status: 201 });
}
