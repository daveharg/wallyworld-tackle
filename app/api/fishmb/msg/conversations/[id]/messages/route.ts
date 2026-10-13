// /api/fishmb/msg/conversations/[id]/messages — ciphertext relay.
// GET ?after=<iso>: my rows. POST: { parts: [{ recipient_id, recipient_key?, nonce, ciphertext }] }.
//
// Two copy formats:
// - v2 (nonce === "v2"): self-contained wrapped-key envelope in the
//   ciphertext field; one copy per (recipient, registered public key),
//   with recipient_key naming the key it was wrapped to.
// - legacy (recipient_key absent): one pairwise-ECDH copy per recipient.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  forbidden,
} from "@/lib/fish/auth";
import { isMember, listMessages, storeMessage, getReactions, getPublicKeys } from "@/lib/fish/messages";
import { blockedEitherWay } from "@/lib/fish/moderation";

const B64 = /^[A-Za-z0-9+/=]+$/;
const V2_NONCE = "v2";

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
  const reactionMap = await getReactions(
    messages.map((m) => m.id),
    g.me!.id
  );
  const withReactions = messages.map((m) => ({
    ...m,
    reactions: reactionMap.get(m.id) ?? [],
  }));
  return NextResponse.json({ messages: withReactions });
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
  // A send can fan out to one copy per (member, key): up to 50 members
  // x 5 keys each. Cap well above that while still bounding abuse.
  if (parts.length === 0 || parts.length > 300) return badRequest("Invalid parts.");
  const clean: { recipient_id: string; recipient_key: string | null; nonce: string; ciphertext: string }[] = [];
  const seen = new Set<string>();
  const recipientIds = new Set<string>();
  for (const p of parts) {
    const r = p as Record<string, unknown>;
    const recipient_id = typeof r.recipient_id === "string" ? r.recipient_id.trim() : "";
    const nonce = typeof r.nonce === "string" ? r.nonce.trim() : "";
    const ciphertext = typeof r.ciphertext === "string" ? r.ciphertext.trim() : "";
    const rawKey = r.recipient_key;
    const recipient_key =
      typeof rawKey === "string" && rawKey.trim() !== "" ? rawKey.trim() : null;
    if (!recipient_id) return badRequest("Invalid parts.");
    // Copies are deduplicated per (recipient, key): many keyed copies to
    // one recipient are legitimate; a second keyless copy is not.
    const dedupeKey = `${recipient_id}|${recipient_key ?? ""}`;
    if (seen.has(dedupeKey)) return badRequest("Invalid parts.");
    if (recipient_key !== null && (!B64.test(recipient_key) || recipient_key.length !== 44))
      return badRequest("Invalid recipient key.");
    if (nonce === V2_NONCE) {
      // v2 copies are meaningless without the key they were wrapped to.
      if (!recipient_key) return badRequest("Invalid parts.");
      // The ciphertext is a JSON envelope { v:2, e, wn, w, mn, c }.
      if (ciphertext.length < 80 || ciphertext.length > 20000)
        return badRequest("Invalid ciphertext.");
      let env: Record<string, unknown> | null = null;
      try {
        env = JSON.parse(ciphertext) as Record<string, unknown>;
      } catch {
        env = null;
      }
      if (
        !env ||
        env.v !== 2 ||
        typeof env.e !== "string" ||
        typeof env.wn !== "string" ||
        typeof env.w !== "string" ||
        typeof env.mn !== "string" ||
        typeof env.c !== "string"
      )
        return badRequest("Invalid ciphertext.");
    } else {
      if (!B64.test(nonce) || nonce.length !== 32) return badRequest("Invalid nonce.");
      if (!B64.test(ciphertext) || ciphertext.length < 24 || ciphertext.length > 20000)
        return badRequest("Invalid ciphertext.");
    }
    seen.add(dedupeKey);
    recipientIds.add(recipient_id);
    clean.push({ recipient_id, recipient_key, nonce, ciphertext });
  }
  // A copy may only be addressed to a key actually registered to that
  // recipient — otherwise senders could file undecryptable junk under
  // arbitrary key labels (and clients group copies by key).
  const keyedRecipients = new Set(
    clean.filter((p) => p.recipient_key !== null).map((p) => p.recipient_id)
  );
  for (const rid of Array.from(keyedRecipients)) {
    const registered = new Set(await getPublicKeys(rid));
    for (const part of clean) {
      if (
        part.recipient_id === rid &&
        part.recipient_key !== null &&
        !registered.has(part.recipient_key)
      )
        return badRequest("Recipient key is not registered.");
    }
  }
  // Blocks: never deliver to a recipient who has blocked the sender.
  // Checked once per recipient, not once per copy.
  for (const rid of Array.from(recipientIds)) {
    if (rid !== g.me!.id && (await blockedEitherWay(rid, g.me!.id))) {
      return badRequest("You're unable to message this angler.");
    }
  }
  try {
    const stored = await storeMessage(id, g.me!.id, clean);
    return NextResponse.json({ messages: stored });
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Could not store message.");
  }
}
