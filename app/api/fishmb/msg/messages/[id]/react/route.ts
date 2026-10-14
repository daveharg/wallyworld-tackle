// POST /api/fishmb/msg/messages/[id]/react — legacy per-row reaction route.
// Kept for older clients: the row id is resolved to its LOGICAL message
// (conversation + sender + server-stamped created_at, shared by every
// copy of the send) and the toggle is applied in fm_msg_reactions, so
// reactions land where current clients read them. New clients should use
// POST /api/fishmb/msg/messages/react with the logical key directly.
// Body: { emoji: string } — toggles that emoji for the viewer.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { ensureMsgTables, toggleLogicalReaction } from "@/lib/fish/messages";
import { nextReaction } from "@/lib/fish/reactions";
import { fishUserFromRequest, badRequest } from "@/lib/fish/auth";

const ALLOWED = new Set([
  "👍", "❤️", "🥰", "😆", "😂", "😮", "😢", "😡", "🖕", "👎", "🔥",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await fishUserFromRequest(req);
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let body: { emoji?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON.");
  }
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  if (!ALLOWED.has(emoji)) return badRequest("Invalid emoji.");
  await ensureMsgTables();
  // The viewer must be the sender or a recipient of this copy.
  const rows = (await query(
    `SELECT conversation_id, sender_id, created_at FROM fm_messages
      WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2) LIMIT 1`,
    [id, me.id]
  )) as { conversation_id: string; sender_id: string; created_at: string }[];
  if (rows.length === 0) return badRequest("Message not found.");
  const msg = rows[0];
  const createdIso = new Date(msg.created_at).toISOString();
  const mine = await query<{ emoji: string }>(
    `SELECT emoji FROM fm_msg_reactions
      WHERE conversation_id = $1 AND sender_id = $2
        AND msg_created_at = date_trunc('milliseconds', $3::timestamptz)
        AND user_id = $4`,
    [msg.conversation_id, msg.sender_id, createdIso, me.id]
  );
  const next = nextReaction(mine[0]?.emoji ?? null, emoji);
  const reactions = await toggleLogicalReaction(
    msg.conversation_id,
    { sender_id: msg.sender_id, created_at: createdIso },
    me.id,
    next
  );
  return NextResponse.json({ reactions });
}
