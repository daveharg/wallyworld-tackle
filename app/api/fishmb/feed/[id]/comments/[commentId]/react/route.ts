// /api/fishmb/feed/[id]/comments/[commentId]/react — like/dislike a comment.
// POST { value: 1 | -1 | null } (auth). 1 = like, -1 = dislike, null = remove.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, suspendedCheck } from "@/lib/fish/auth";
import { toggleCommentReaction } from "@/lib/fish/feed";

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
  const value = v === 1 || v === -1 ? v : v === null ? null : undefined;
  if (value === undefined) return badRequest("value must be 1, -1, or null.");
  const result = await toggleCommentReaction(params.commentId, me.id, value);
  return NextResponse.json(result);
}
