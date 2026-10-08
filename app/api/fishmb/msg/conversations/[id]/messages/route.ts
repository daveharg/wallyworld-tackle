// /api/fishmb/msg/conversations/[id]/messages — ciphertext relay.
// GET ?after=<iso>: my rows. POST: { parts: [{ recipient_id, nonce, ciphertext }] }.
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
  const messages = await listMessages(id, g.me!.id, after);
  return NextResponse.json({ messages });
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
  const parts = Array.isArray(body.parts) ? body.parts : [];
  if (parts.length === 0 || parts.length > 50) return badRequest("Invalid parts.");
  const clean: { recipient_id: string; nonce: string; ciphertext: string }[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const r = p as Record<string, unknown>;
    const recipient_id = typeof r.recipient_id === "string" ? r.recipient_id.trim() : "";
    const nonce = typeof r.nonce === "string" ? r.nonce.trim() : "";
    const ciphertext = typeof r.ciphertext === "string" ? r.ciphertext.trim() : "";
    if (!recipient_id || seen.has(recipient_id)) return badRequest("Invalid parts.");
    if (!B64.test(nonce) || nonce.length !== 32) return badRequest("Invalid nonce.");
    if (!B64.test(ciphertext) || ciphertext.length < 24 || ciphertext.length > 20000)
      return badRequest("Invalid ciphertext.");
    seen.add(recipient_id);
    clean.push({ recipient_id, nonce, ciphertext });
  }
  try {
    const stored = await storeMessage(id, g.me!.id, clean);
    return NextResponse.json({ messages: stored });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Could not store message.");
  }
}
