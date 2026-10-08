// /api/fishmb/msg/conversations/[id]/messages — ciphertext relay.
// GET ?after=<iso>: messages. POST: { nonce, ciphertext } stores one.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  forbidden,
} from "@/lib/fish/auth";
import { isMember, listMessages, storeMessage } from "@/lib/fish/messages";

const B64 = /^[A-Za-z0-9+/=]+$/;

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
  const after = new URL(req.url).searchParams.get("after") ?? undefined;
  const messages = await listMessages(id, after);
  return NextResponse.json({ messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const g = await guard(req, id);
  if (!g.err) {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON body.");
    }
    const nonce = typeof body.nonce === "string" ? body.nonce.trim() : "";
    const ciphertext = typeof body.ciphertext === "string" ? body.ciphertext.trim() : "";
    // 24-byte nonce -> 32 chars; ciphertext must be non-trivial base64.
    if (!B64.test(nonce) || nonce.length !== 32) return badRequest("Invalid nonce.");
    if (!B64.test(ciphertext) || ciphertext.length < 24 || ciphertext.length > 20000)
      return badRequest("Invalid ciphertext.");
    const msg = await storeMessage(id, g.me!.id, nonce, ciphertext);
    return NextResponse.json({ message: msg });
  }
  return g.err;
}
