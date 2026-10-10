// PATCH /api/fishmb/msg/conversations/[id] — update group name/avatar (members only).
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { ensureMsgTables } from "@/lib/fish/messages";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  await ensureMsgTables();

  // Must be a member of this conversation.
  const member = await query(
    `SELECT 1 FROM fm_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
    [params.id, me.id]
  );
  if (member.length === 0) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 60);
    if (name.length === 0) {
      return NextResponse.json({ error: "Name can't be empty." }, { status: 400 });
    }
    updates.push(`name = $${i++}`);
    values.push(name);
  }
  if (typeof body.avatar_url === "string") {
    const url = body.avatar_url.trim().slice(0, 500);
    updates.push(`avatar_url = $${i++}`);
    values.push(url.length > 0 ? url : null);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  values.push(params.id);
  await query(
    `UPDATE fm_conversations SET ${updates.join(", ")} WHERE id = $${i}`,
    values
  );
  return NextResponse.json({ ok: true });
}

// POST /api/fishmb/msg/conversations/[id]/members — add a user to the group (members only).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  await ensureMsgTables();

  // Must be a member of this conversation.
  const member = await query(
    `SELECT 1 FROM fm_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
    [params.id, me.id]
  );
  if (member.length === 0) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "user_id required." }, { status: 400 });
  }

  // Verify the user exists.
  const target = await query(`SELECT id FROM fm_users WHERE id = $1`, [userId]);
  if (target.length === 0) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Add them (idempotent).
  await query(
    `INSERT INTO fm_conversation_members (conversation_id, user_id, joined_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (conversation_id, user_id) DO NOTHING`,
    [params.id, userId]
  );

  return NextResponse.json({ ok: true });
}

// DELETE /api/fishmb/msg/conversations/[id]/members — remove a user from the group (members only).
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  await ensureMsgTables();

  // Must be a member of this conversation.
  const member = await query(
    `SELECT 1 FROM fm_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
    [params.id, me.id]
  );
  if (member.length === 0) {
    return NextResponse.json({ error: "Not a member." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id")?.trim() ?? "";
  if (!userId) {
    return NextResponse.json({ error: "user_id required." }, { status: 400 });
  }

  // Can't remove yourself — use "leave" instead (not implemented here).
  if (userId === me.id) {
    return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
  }

  await query(
    `DELETE FROM fm_conversation_members WHERE conversation_id = $1 AND user_id = $2`,
    [params.id, userId]
  );

  return NextResponse.json({ ok: true });
}
