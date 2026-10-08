// /api/fishmb/msg/conversations — my conversations.
// GET: list with previews + unread counts.
// POST: { other_user_id } -> find-or-create 1:1,
//       { member_ids: string[], name?: string } -> create group.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import {
  listConversations,
  findDirectConversation,
  createConversation,
  getPublicKey,
} from "@/lib/fish/messages";
import { query } from "@/lib/fish/db";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const convos = await listConversations(me.id);
  return NextResponse.json({ conversations: convos });
}

async function myKeyReady(userId: string): Promise<boolean> {
  return !!(await getPublicKey(userId));
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  // Group chat.
  if (Array.isArray(body.member_ids)) {
    const ids = Array.from(new Set((body.member_ids as unknown[]).filter((x) => typeof x === "string") as string[])).filter(
      (x) => x && x !== me.id
    );
    if (ids.length === 0) return badRequest("Add at least one friend.");
    if (ids.length > 49) return badRequest("Groups are limited to 50 people.");
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    const rows = await query<{ id: string }>(
      `SELECT id FROM fm_users WHERE id = ANY($1)`,
      [ids]
    );
    if (rows.length !== ids.length) return notFound("A friend was not found.");
    // Anyone can be added — members without keys yet simply can't read
    // messages until they enable encrypted messaging. Only the creator
    // needs keys (they're the one encrypting).
    if (!(await myKeyReady(me.id))) return badRequest("Set up your messaging keys first.");
    const id = await createConversation([me.id, ...ids], name || null);
    return NextResponse.json({ id });
  }

  // 1:1 chat.
  const otherId = typeof body.other_user_id === "string" ? body.other_user_id.trim() : "";
  if (!otherId || otherId === me.id) return badRequest("Invalid user.");
  const rows = await query<{ id: string }>(`SELECT id FROM fm_users WHERE id = $1`, [otherId]);
  if (rows.length === 0) return notFound("User not found.");
  // Anyone can be messaged — a user without keys yet just can't read
  // messages until they enable encrypted messaging.
  if (!(await myKeyReady(me.id))) return badRequest("Set up your messaging keys first.");
  const id =
    (await findDirectConversation(me.id, otherId)) ??
    (await createConversation([me.id, otherId], null));
  return NextResponse.json({ id });
}
