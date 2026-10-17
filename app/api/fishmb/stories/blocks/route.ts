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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // Validate the shape up front: a malformed id would otherwise die
  // as a 500 on the uuid cast inside the insert (2026-10-16 review).
  if (!UUID_RE.test(userId)) return badRequest("user_id must be a user id.");
  if (userId === me.id) return badRequest("You can't hide your own stories.");

  try {
    await blockStories(me.id, userId);
  } catch (e) {
    // Foreign-key violation = the target user doesn't exist.
    if ((e as { code?: string })?.code === "23503") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    throw e;
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const userId = req.nextUrl.searchParams.get("user_id") ?? "";
  if (!userId) return badRequest("user_id required.");
  if (!UUID_RE.test(userId)) return badRequest("user_id must be a user id.");
  await unblockStories(me.id, userId);
  return NextResponse.json({ ok: true });
}
