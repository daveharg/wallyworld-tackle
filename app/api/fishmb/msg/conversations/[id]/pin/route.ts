// /api/fishmb/msg/conversations/[id]/pin — pin/unpin a conversation for me.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  forbidden,
  badRequest,
} from "@/lib/fish/auth";
import { isMember, setPinned } from "@/lib/fish/messages";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;
  if (!(await isMember(id, me.id))) return forbidden();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  await setPinned(id, me.id, body.pinned === true);
  return NextResponse.json({ ok: true });
}
