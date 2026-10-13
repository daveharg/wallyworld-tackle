// POST /api/fishmb/msg/conversations/[id]/hide — "delete chat" for me.
// Per-user hide only: sets hidden_at on MY membership row. The chat
// disappears from my list until a newer message arrives (or I open the
// thread directly); my membership and history are untouched, and no
// other member is affected. (DELETE on the conversation route already
// means member removal, so hide gets its own action route.)
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, forbidden } from "@/lib/fish/auth";
import { isMember, hideConversation } from "@/lib/fish/messages";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  if (!(await isMember(id, me.id))) return forbidden();
  await hideConversation(id, me.id);
  return NextResponse.json({ ok: true });
}
