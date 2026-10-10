// GET /api/fishmb/stories — stories from friends + followed (+ own), unexpired.
// POST /api/fishmb/stories — create a story { media_url, media_type?, caption? }.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { ensureStoryTables, getStories } from "@/lib/fish/feed";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req).catch(() => null);
  await ensureStoryTables();
  const stories = await getStories(me ? me.id : null);
  return NextResponse.json({ stories });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureStoryTables();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const mediaUrl = typeof body.media_url === "string" ? body.media_url.trim() : "";
  if (!mediaUrl || !/^https?:\/\//.test(mediaUrl)) {
    return NextResponse.json({ error: "A photo or video URL is required." }, { status: 400 });
  }
  const mediaType = body.media_type === "video" ? "video" : "photo";
  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 200) : null;
  const overlays = Array.isArray(body.overlays)
    ? body.overlays.slice(0, 10).map((o: Record<string, unknown>) => ({
        text: String(o.text ?? "").slice(0, 100),
        x: Math.max(0, Math.min(100, Number(o.x) || 50)),
        y: Math.max(0, Math.min(100, Number(o.y) || 50)),
        font: String(o.font ?? "bold"),
        color: String(o.color ?? "#ffffff"),
        bg: String(o.bg ?? "transparent"),
        size: Math.max(12, Math.min(72, Number(o.size) || 28)),
      }))
    : [];

  const zoom = Math.max(1, Math.min(3, Number(body.zoom) || 1));

  const rows = await query<{ id: string }>(
    `INSERT INTO fm_stories (user_id, media_url, media_type, caption, overlays, zoom)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [me.id, mediaUrl, mediaType, caption, JSON.stringify(overlays), zoom]
  );
  return NextResponse.json({ ok: true, id: rows[0].id });
}
