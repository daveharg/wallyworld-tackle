// POST /api/fish/friends/request — send a friend request (auth required).
// Body: { email } or { user_id } — the angler to befriend.

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
  type FishUser,
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

  let target: FishUser | null = null;
  if (typeof body.user_id === "string" && body.user_id) {
    target = await queryOne<FishUser>(`SELECT * FROM fm_users WHERE id = $1`, [body.user_id]);
  } else if (typeof body.email === "string" && body.email) {
    target = await queryOne<FishUser>(
      `SELECT * FROM fm_users WHERE LOWER(email) = LOWER($1)`,
      [body.email.trim()]
    );
  } else {
    return badRequest("Provide user_id or email.");
  }
  if (!target) return notFound("Angler not found.");
  if (target.id === me.id) return badRequest("You can't friend yourself.");

  const existing = await queryOne<{ status: string; requester_id: string }>(
    `SELECT status, requester_id FROM fm_friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)`,
    [me.id, target.id]
  );
  if (existing) {
    if (existing.status === "accepted") return badRequest("You're already friends.");
    if (existing.status === "blocked") return badRequest("Unable to send request.");
    return badRequest("A request is already pending.");
  }

  await query(
    `INSERT INTO fm_friendships (requester_id, addressee_id, status)
     VALUES ($1, $2, 'pending')`,
    [me.id, target.id]
  );
  return NextResponse.json(
    { ok: true, to: { id: target.id, name: target.name } },
    { status: 201 }
  );
}
