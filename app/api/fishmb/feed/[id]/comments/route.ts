// /api/fishmb/feed/[id]/comments — GET comments / POST a comment (auth).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, suspendedCheck } from "@/lib/fish/auth";
import { getComments, addComment } from "@/lib/fish/feed";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req).catch(() => null);
  const comments = await getComments(params.id, me?.id);
  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 1000) : "";
  const photoUrl = typeof body.photo_url === "string" && /^https?:\/\//.test(body.photo_url) ? body.photo_url.slice(0, 2048) : null;
  if (!text && !photoUrl) return badRequest("Write something or add a photo first.");
  const parentId = typeof body.parent_id === "string" && body.parent_id.trim() ? body.parent_id.trim() : null;
  const comment = await addComment(params.id, me.id, text, parentId, photoUrl);
  return NextResponse.json({ comment }, { status: 201 });
}
