// /api/fishmb/feed/[id]/comments/[commentId]/react — react to a comment.
// POST { value: number | null } (auth) — a reaction code from
// lib/fish/reactions.ts (1 👍, -1 👎 legacy, 2 😆, 3 ❤️, 4 🥰, 5 😮, 6 😢,
// 7 😡, 8 🖕), null = remove.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, suspendedCheck } from "@/lib/fish/auth";
import { toggleCommentReaction } from "@/lib/fish/feed";
import { isFeedReactionValue } from "@/lib/fish/reactions";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const susp = suspendedCheck(me);
  if (susp) return susp;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const v = body.value;
  const value = v === null ? null : isFeedReactionValue(v) ? v : undefined;
  if (value === undefined) return badRequest("value must be a reaction code or null.");
  const result = await toggleCommentReaction(params.commentId, me.id, value);
  return NextResponse.json(result);
}
