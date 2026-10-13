// /api/fishmb/feed/[id] — edit or delete your own feed post.
// PUT { body?, visibility? } — updates the post text (discussions.body,
// or catches.feed_caption) and/or who it's shared with. Owner-only both.
// DELETE — removes the post plus its reactions/comments. Owner-only both.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, notFound } from "@/lib/fish/auth";
import { ensureFeedColumns } from "@/lib/fish/feed";
import { query, queryOne } from "@/lib/fish/db";

async function ownedTable(id: string, userId: string): Promise<"fm_discussions" | "fm_catches" | null> {
  await ensureFeedColumns();
  const d = await queryOne(`SELECT id FROM fm_discussions WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (d) return "fm_discussions";
  const c = await queryOne(`SELECT id FROM fm_catches WHERE id = $1 AND user_id = $2`, [id, userId]);
  if (c) return "fm_catches";
  return null;
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const table = await ownedTable(params.id, me.id);
  if (!table) return notFound("Post not found.");
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
  // Sharing can be changed on edit too: everyone / friends / followers,
  // plus "private" (only me) for catches — a private discussion makes no
  // sense, so posts can't be set private here.
  const VISIBILITIES =
    table === "fm_catches"
      ? ["public", "friends", "followers", "private"]
      : ["public", "friends", "followers"];
  const visibility =
    typeof body.visibility === "string" && VISIBILITIES.includes(body.visibility)
      ? body.visibility
      : null;
  if (!text && !visibility) return badRequest("Nothing to update.");
  const column = table === "fm_discussions" ? "body" : "feed_caption";
  if (text && visibility) {
    await query(`UPDATE ${table} SET ${column} = $1, visibility = $2 WHERE id = $3`, [
      text,
      visibility,
      params.id,
    ]);
  } else if (text) {
    await query(`UPDATE ${table} SET ${column} = $1 WHERE id = $2`, [text, params.id]);
  } else {
    await query(`UPDATE ${table} SET visibility = $1 WHERE id = $2`, [visibility, params.id]);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const table = await ownedTable(params.id, me.id);
  if (!table) return notFound("Post not found.");
  // Catches: removing from the feed just unshares it — the catch stays on
  // the angler's catch list. Only discussion posts are truly deleted.
  if (table === "fm_catches") {
    await query(`UPDATE fm_catches SET visibility = 'private', personal_record = true WHERE id = $1`, [params.id]);
    return NextResponse.json({ ok: true, unshared: true });
  }
  // Clean up reactions + comments that reference this post, then the post itself.
  // (fm_post_reactions.post_id has no FK since a "post" is either table.)
  await query(`DELETE FROM fm_post_reactions WHERE post_id = $1`, [params.id]).catch(() => {});
  await query(`DELETE FROM fm_comments WHERE post_id = $1`, [params.id]).catch(() => {});
  await query(`DELETE FROM ${table} WHERE id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}
