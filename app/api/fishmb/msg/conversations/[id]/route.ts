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
