// /api/fish/discussions/[id] — owner-only discussion delete.
// DELETE → auth required; only the post's author can delete it.

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
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  const row = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM fm_discussions WHERE id = $1`,
    [params.id]
  );
  if (!row) return notFound("Discussion not found.");
  if (row.user_id !== me.id) {
    return forbidden("You can only delete your own posts.");
  }

  await query(`DELETE FROM fm_discussions WHERE id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}
