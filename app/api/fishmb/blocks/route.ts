// GET    /api/fishmb/blocks            — anglers you've blocked.
// POST   /api/fishmb/blocks            — { user_id } block an angler.
// DELETE /api/fishmb/blocks?user_id=…  — unblock.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
} from "@/lib/fish/auth";
import {
  blockUser,
  unblockUser,
  listBlockedUsers,
} from "@/lib/fish/moderation";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const blocked = await listBlockedUsers(me.id);
  return NextResponse.json({ blocked });
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
  const userId = String(body.user_id ?? "");
  if (!userId) return badRequest("user_id required.");
  if (userId === me.id) return badRequest("You can't block yourself.");
  await blockUser(me.id, userId);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const userId = req.nextUrl.searchParams.get("user_id") ?? "";
  if (!userId) return badRequest("user_id required.");
  await unblockUser(me.id, userId);
  return NextResponse.json({ ok: true });
}
