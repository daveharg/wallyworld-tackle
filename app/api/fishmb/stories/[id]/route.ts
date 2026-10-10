// POST /api/fishmb/stories/[id]/view — mark a story as viewed.
// DELETE /api/fishmb/stories/[id] — delete your own story.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { ensureStoryTables } from "@/lib/fish/feed";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureStoryTables();

  await query(
    `INSERT INTO fm_story_views (story_id, viewer_id)
     VALUES ($1, $2)
     ON CONFLICT (story_id, viewer_id) DO NOTHING`,
    [params.id, me.id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureStoryTables();

  await query(`DELETE FROM fm_stories WHERE id = $1 AND user_id = $2`, [
    params.id,
    me.id,
  ]);
  return NextResponse.json({ ok: true });
}
