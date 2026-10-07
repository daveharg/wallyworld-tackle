// POST /api/fish/friends/respond — accept or decline a request (auth required).
// Body: { requester_id, accept: boolean }. Only the addressee can respond.

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const requesterId = body.requester_id;
  if (typeof requesterId !== "string" || !requesterId) {
    return badRequest("requester_id is required.");
  }
  if (typeof body.accept !== "boolean") {
    return badRequest("accept must be true or false.");
  }

  const row = await queryOne<{ id: string }>(
    `SELECT id FROM fm_friendships
      WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [requesterId, me.id]
  );
  if (!row) return notFound("No pending request from that angler.");

  if (body.accept) {
    await query(`UPDATE fm_friendships SET status = 'accepted' WHERE id = $1`, [row.id]);
    return NextResponse.json({ ok: true, accepted: true });
  }
  await query(`DELETE FROM fm_friendships WHERE id = $1`, [row.id]);
  return NextResponse.json({ ok: true, accepted: false });
}
