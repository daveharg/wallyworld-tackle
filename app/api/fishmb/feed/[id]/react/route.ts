// /api/fishmb/feed/[id]/react — like/dislike a feed item.
// POST { value: 1 | -1 | null } — 1 = like, -1 = dislike, null = remove reaction.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, notFound } from "@/lib/fish/auth";
import { ensureFeedColumns, toggleReaction } from "@/lib/fish/feed";
import { queryOne } from "@/lib/fish/db";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const value = body.value;
  if (value !== 1 && value !== -1 && value !== null) {
    return badRequest("value must be 1, -1, or null.");
  }
  await ensureFeedColumns();
  // A feed item is either a discussion or a catch.
  const exists = await queryOne(
    `SELECT id FROM fm_discussions WHERE id = $1
     UNION ALL
     SELECT id FROM fm_catches WHERE id = $1
     LIMIT 1`,
    [params.id]
  );
  if (!exists) return notFound("Post not found.");
  const result = await toggleReaction(params.id, me.id, value);
  return NextResponse.json(result);
}
