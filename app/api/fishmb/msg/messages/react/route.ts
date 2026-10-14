// POST /api/fishmb/msg/messages/react — react to a LOGICAL message.
// Body: { conversation_id, sender_id, msg_created_at, emoji | null }.
//
// A send is stored as one row per (recipient, key/device) copy; all copies
// share sender_id + the server-stamped created_at. Reactions key off that
// pair (inside the conversation) so a reaction shows on every
// participant's copy. Facebook semantics: one reaction per user —
// sending the emoji you already have (or null) clears it, a different
// emoji switches. Emoji set: the Facebook seven plus 🖕 (Messenger only).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, forbidden } from "@/lib/fish/auth";
import { isMember, toggleLogicalReaction } from "@/lib/fish/messages";
import { isMsgReactionEmoji, nextReaction } from "@/lib/fish/reactions";
import { query } from "@/lib/fish/db";
import { ensureMsgTables } from "@/lib/fish/messages";

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const conversationId =
    typeof body.conversation_id === "string" ? body.conversation_id.trim() : "";
  const senderId = typeof body.sender_id === "string" ? body.sender_id.trim() : "";
  const createdAt =
    typeof body.msg_created_at === "string" ? body.msg_created_at.trim() : "";
  if (!conversationId || !senderId || !createdAt) {
    return badRequest("conversation_id, sender_id and msg_created_at are required.");
  }
  if (Number.isNaN(Date.parse(createdAt))) return badRequest("Invalid msg_created_at.");
  if (!(await isMember(conversationId, me.id))) return forbidden();
  // The logical message must actually exist in this conversation.
  await ensureMsgTables();
  const exists = await query(
    `SELECT 1 FROM fm_messages
      WHERE conversation_id = $1 AND sender_id = $2
        AND date_trunc('milliseconds', created_at) = date_trunc('milliseconds', $3::timestamptz)
      LIMIT 1`,
    [conversationId, senderId, createdAt]
  );
  if (exists.length === 0) return badRequest("Message not found.");
  const raw = body.emoji;
  if (raw !== null && raw !== undefined && !isMsgReactionEmoji(raw)) {
    return badRequest("Invalid emoji.");
  }
  const picked = isMsgReactionEmoji(raw) ? raw : null;
  // Resolve toggle against the viewer's current reaction.
  const mine = await query<{ emoji: string }>(
    `SELECT emoji FROM fm_msg_reactions
      WHERE conversation_id = $1 AND sender_id = $2
        AND msg_created_at = date_trunc('milliseconds', $3::timestamptz)
        AND user_id = $4`,
    [conversationId, senderId, createdAt, me.id]
  );
  const next = nextReaction(mine[0]?.emoji ?? null, picked);
  const reactions = await toggleLogicalReaction(
    conversationId,
    { sender_id: senderId, created_at: createdAt },
    me.id,
    next
  );
  return NextResponse.json({ reactions });
}
