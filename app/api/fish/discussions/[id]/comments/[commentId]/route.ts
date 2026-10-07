// /api/fish/discussions/[id]/comments/[commentId] — owner-only comment delete.
// DELETE → auth required; only the comment's author can delete it.

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
  notFound,
} from "@/lib/fish/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  const row = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM fm_comments WHERE id = $1 AND post_id = $2`,
    [params.commentId, params.id]
  );
  if (!row) return notFound("Comment not found.");
  if (row.user_id !== me.id) {
    return forbidden("You can only delete your own comments.");
  }

  await query(`DELETE FROM fm_comments WHERE id = $1`, [params.commentId]);
  return NextResponse.json({ ok: true });
}
