// GET /api/fishmb/story-drafts — your saved story photos/videos.
// POST /api/fishmb/story-drafts — save one { media_url, media_type? }.
// DELETE /api/fishmb/story-drafts?id=... — remove one.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { ensureStoryTables } from "@/lib/fish/feed";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureStoryTables();
  const rows = await query(
    `SELECT id, media_url, media_type, duration, created_at
       FROM fm_story_drafts
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [me.id]
  );
  return NextResponse.json({ drafts: rows });
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
  const duration = typeof body.duration === "number" ? body.duration : null;

  const rows = await query<{ id: string }>(
    `INSERT INTO fm_story_drafts (user_id, media_url, media_type, duration)
     VALUES ($1, $2, $3, $4) RETURNING id, media_url, media_type, duration, created_at`,
    [me.id, mediaUrl, mediaType, duration]
  );
  return NextResponse.json({ ok: true, draft: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureStoryTables();

  const id = new URL(req.url).searchParams.get("id") ?? "";
  await query(`DELETE FROM fm_story_drafts WHERE id = $1 AND user_id = $2`, [id, me.id]);
  return NextResponse.json({ ok: true });
}
