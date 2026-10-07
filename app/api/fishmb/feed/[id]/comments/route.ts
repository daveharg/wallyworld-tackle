// /api/fishmb/feed/[id]/comments — GET comments / POST a comment (auth).

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { getComments, addComment } from "@/lib/fish/feed";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const comments = await getComments(params.id);
  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 1000) : "";
  if (!text) return badRequest("Write something first.");
  const comment = await addComment(params.id, me.id, text);
  return NextResponse.json({ comment }, { status: 201 });
}
