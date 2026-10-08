// /api/fishmb/msg/conversations/[id]/members — group membership.
// GET: members with public keys. POST: { user_id } add a friend.
// DELETE: leave the conversation.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  forbidden,
  notFound,
} from "@/lib/fish/auth";
import { isMember, getMembers, addMember, removeMember, getPublicKey } from "@/lib/fish/messages";
import { queryOne } from "@/lib/fish/db";

async function guard(req: NextRequest, id: string) {
  const me = await fishUserFromRequest(req);
  if (!me) return { err: unauthorized() };
  if (!(await isMember(id, me.id))) return { err: forbidden() };
  return { me };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const g = await guard(req, id);
  if (g.err) return g.err;
  return NextResponse.json({ members: await getMembers(id) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const g = await guard(req, id);
  if (g.err) return g.err;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!userId || userId === g.me!.id) return badRequest("Invalid user.");
  const exists = await queryOne<{ n: string }>(`SELECT 1 AS n FROM fm_users WHERE id = $1`, [userId]);
  if (!exists) return notFound("User not found.");
  if (!(await getPublicKey(userId)))
    return badRequest("That angler hasn't set up encrypted messaging yet.");
  await addMember(id, userId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const g = await guard(req, id);
  if (g.err) return g.err;
  await removeMember(id, g.me!.id);
  return NextResponse.json({ ok: true });
}
