// /api/fishmb/feed/[id]/react — react to a feed item.
// POST { value: number | null } — a reaction code from lib/fish/reactions.ts
// (1 👍, -1 👎 legacy, 2 😆, 3 ❤️, 4 🥰, 5 😮, 6 😢, 7 😡), null = remove.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, notFound } from "@/lib/fish/auth";
import { ensureFeedColumns, toggleReaction } from "@/lib/fish/feed";
import { isFeedReactionValue } from "@/lib/fish/reactions";
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
  if (value !== null && !isFeedReactionValue(value)) {
    return badRequest("value must be a reaction code or null.");
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
