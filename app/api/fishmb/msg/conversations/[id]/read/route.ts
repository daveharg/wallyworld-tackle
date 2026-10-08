// /api/fishmb/msg/conversations/[id]/read — mark a conversation read.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, forbidden } from "@/lib/fish/auth";
import { isMember, markRead } from "@/lib/fish/messages";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await isMember(id, me.id))) return forbidden();
  await markRead(id, me.id);
  return NextResponse.json({ ok: true });
}
