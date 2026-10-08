// /api/fishmb/msg/conversations — my 1:1 conversations.
// GET: list with previews + unread counts. POST: { other_user_id } find-or-create.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import {
  listConversations,
  findConversation,
  createConversation,
  getPublicKey,
} from "@/lib/fish/messages";
import { queryOne } from "@/lib/fish/db";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const convos = await listConversations(me.id);
  return NextResponse.json({ conversations: convos });
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
  const otherId = typeof body.other_user_id === "string" ? body.other_user_id.trim() : "";
  if (!otherId || otherId === me.id) return badRequest("Invalid user.");
  const exists = await queryOne<{ n: string }>(`SELECT 1 AS n FROM fm_users WHERE id = $1`, [otherId]);
  if (!exists) return notFound("User not found.");
  // Both sides need keys before an encrypted conversation can start.
  const [myKey, theirKey] = await Promise.all([
    getPublicKey(me.id),
    getPublicKey(otherId),
  ]);
  if (!myKey || !theirKey) {
    return badRequest(
      !theirKey
        ? "That angler hasn't set up encrypted messaging yet."
        : "Set up your messaging keys first."
    );
  }
  const id = (await findConversation(me.id, otherId)) ?? (await createConversation(me.id, otherId));
  return NextResponse.json({ id });
}
