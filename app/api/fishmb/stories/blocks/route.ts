// GET    /api/fishmb/stories/blocks          — anglers whose stories you've hidden.
// POST   /api/fishmb/stories/blocks          — { user_id } hide an angler's stories.
// DELETE /api/fishmb/stories/blocks?user_id=… — stop hiding an angler's stories.

import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  fishUserFromRequest,
  unauthorized,
} from "@/lib/fish/auth";
import {
  blockStories,
  listStoryBlocks,
  unblockStories,
} from "@/lib/fish/feed";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const blocked = await listStoryBlocks(me.id);
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
  if (userId === me.id) return badRequest("You can't hide your own stories.");

  await blockStories(me.id, userId);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const userId = req.nextUrl.searchParams.get("user_id") ?? "";
  if (!userId) return badRequest("user_id required.");
  await unblockStories(me.id, userId);
  return NextResponse.json({ ok: true });
}
