// GET /api/fish/follows?user_id=... — check if I follow this user.
// POST /api/fish/follows — follow a user { user_id }.
// DELETE /api/fish/follows?user_id=... — unfollow a user.
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { ensureFollowTables } from "@/lib/fish/feed";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureFollowTables();

  const userId = new URL(req.url).searchParams.get("user_id")?.trim() ?? "";
  if (!userId) return NextResponse.json({ following: false });

  const rows = await query(
    `SELECT 1 FROM fm_follows WHERE follower_id = $1 AND followee_id = $2`,
    [me.id, userId]
  );
  return NextResponse.json({ following: rows.length > 0 });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureFollowTables();

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!userId || userId === me.id) {
    return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  }

  // The target must allow follows.
  const target = await query(
    `SELECT allow_follow FROM fm_users WHERE id = $1`,
    [userId]
  );
  if (target.length === 0) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (!target[0].allow_follow) {
    return NextResponse.json({ error: "This user doesn't allow follows." }, { status: 403 });
  }

  await query(
    `INSERT INTO fm_follows (follower_id, followee_id)
     VALUES ($1, $2)
     ON CONFLICT (follower_id, followee_id) DO NOTHING`,
    [me.id, userId]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  await ensureFollowTables();

  const userId = new URL(req.url).searchParams.get("user_id")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "user_id required." }, { status: 400 });
  }

  await query(
    `DELETE FROM fm_follows WHERE follower_id = $1 AND followee_id = $2`,
    [me.id, userId]
  );
  return NextResponse.json({ ok: true });
}
