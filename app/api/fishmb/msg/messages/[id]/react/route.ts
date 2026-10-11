// POST /api/fishmb/msg/messages/[id]/react — toggle a reaction on a message.
// Body: { emoji: string }. Toggles: if you already reacted with that emoji, removes it.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { ensureMsgTables } from "@/lib/fish/messages";
import { fishUserFromRequest, badRequest } from "@/lib/fish/auth";

const ALLOWED = new Set(["❤️", "🖕", "😂", "😮", "😢", "👍", "👎", "🔥"]);

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
  // Verify the message exists and the user can see it (is sender or recipient).
  const msg = (await query(
    `SELECT id FROM fm_messages WHERE id = $1 AND (sender_id = $2 OR recipient_id = $2) LIMIT 1`,
    [id, me.id]
  )) as { id: string }[];
  if (msg.length === 0) return badRequest("Message not found.");
  // Toggle.
  const existing = (await query(
    `SELECT 1 FROM fm_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 LIMIT 1`,
    [id, me.id, emoji]
  )) as { "?column?": number }[];
  if (existing.length > 0) {
    await query(
      `DELETE FROM fm_message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [id, me.id, emoji]
    );
  } else {
    await query(
      `INSERT INTO fm_message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [id, me.id, emoji]
    );
  }
  // Return updated reaction counts for this message.
  const counts = (await query(
    `SELECT emoji, COUNT(*)::int AS n,
       BOOL_OR(user_id = $2) AS mine
     FROM fm_message_reactions WHERE message_id = $1 GROUP BY emoji`,
    [id, me.id]
  )) as { emoji: string; n: number; mine: boolean }[];
  return NextResponse.json({ reactions: counts });
}
