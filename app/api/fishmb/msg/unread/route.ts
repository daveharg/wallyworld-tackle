// /api/fishmb/msg/unread — total unread encrypted messages.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { totalUnread } from "@/lib/fish/messages";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  return NextResponse.json({ unread: await totalUnread(me.id) });
}
