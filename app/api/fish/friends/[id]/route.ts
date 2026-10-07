// DELETE /api/fish/friends/[id] — remove a friend or cancel a request.
// [id] is the OTHER angler's user id. Either side may end the friendship.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!id || id === me.id) return badRequest("Invalid friend id.");

  const res = await query(
    `DELETE FROM fm_friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)`,
    [me.id, id]
  );
  return NextResponse.json({ ok: true });
}
