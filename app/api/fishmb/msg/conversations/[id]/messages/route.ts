// /api/fishmb/msg/conversations/[id]/messages — ciphertext relay.
// GET ?after=<iso>: my rows. POST: { parts: [{ recipient_id, recipient_key?, nonce, ciphertext }] }.
//
// Copy formats:
// - v2 (nonce === "v2"): self-contained wrapped-key envelope in the
//   ciphertext field; one copy per (recipient, registered public key),
//   with recipient_key naming the key it was wrapped to.
// - sig1 (proto === "sig1", nonce === "sig1"): Signal-protocol copy;
//   recipient_key is the recipient device's registered identity key and
//   the ciphertext is an opaque Signal message (length-bounded only).
// - legacy (recipient_key absent): one pairwise-ECDH copy per recipient.
import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  forbidden,
} from "@/lib/fish/auth";
import { isMember, listMessages, storeMessage, getReactions, getPublicKeys } from "@/lib/fish/messages";
import { isDeviceIdentity } from "@/lib/fish/signal";
import { blockedEitherWay } from "@/lib/fish/moderation";

const B64 = /^[A-Za-z0-9+/=]+$/;
const V2_NONCE = "v2";
const SIG1 = "sig1";

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
  const clean: {
    recipient_id: string;
    recipient_key: string | null;
    proto: string | null;
    nonce: string;
    ciphertext: string;
  }[] = [];
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
    const proto =
      typeof r.proto === "string" && r.proto.trim() !== "" ? r.proto.trim() : null;
    if (!recipient_id) return badRequest("Invalid parts.");
    // Only protocols this server knows how to validate may be relayed.
    if (proto !== null && proto !== SIG1) return badRequest("Invalid parts.");
    // Copies are deduplicated per (recipient, proto, key): many keyed
    // copies to one recipient are legitimate; a second keyless copy
    // under the same protocol is not.
    const dedupeKey = `${recipient_id}|${proto ?? ""}|${recipient_key ?? ""}`;
    if (seen.has(dedupeKey)) return badRequest("Invalid parts.");
    if (recipient_key !== null && (!B64.test(recipient_key) || recipient_key.length !== 44))
      return badRequest("Invalid recipient key.");
    if (proto === SIG1) {
      // Signal copies: the nonce slot carries the protocol marker, the
      // recipient_key must name the recipient device's identity key
      // (registration is checked against sig_devices below), and the
      // ciphertext is an opaque Signal message — length bounds only.
      // The v2 envelope checks and the fm_user_keys registration check
      // do not apply to these parts.
      if (nonce !== SIG1) return badRequest("Invalid parts.");
      if (!recipient_key) return badRequest("Invalid recipient key.");
      if (ciphertext.length < 100 || ciphertext.length > 128000)
        return badRequest("Invalid ciphertext.");
    } else if (nonce === V2_NONCE) {
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
    clean.push({ recipient_id, recipient_key, proto, nonce, ciphertext });
  }
  // Signal copies: recipient_key must be a registered Signal device
  // identity for that recipient (sig_devices, not fm_user_keys).
  const sigChecked = new Set<string>();
  for (const part of clean) {
    if (part.proto !== SIG1 || part.recipient_key === null) continue;
    const checkKey = `${part.recipient_id}|${part.recipient_key}`;
    if (sigChecked.has(checkKey)) continue;
    sigChecked.add(checkKey);
    if (!(await isDeviceIdentity(part.recipient_id, part.recipient_key))) {
      return badRequest("Recipient device is not registered.");
    }
  }
  // A non-Signal copy may only be addressed to a key actually registered
  // to that recipient — otherwise senders could file undecryptable junk
  // under arbitrary key labels (and clients group copies by key).
  const keyedRecipients = new Set(
    clean
      .filter((p) => p.proto !== SIG1 && p.recipient_key !== null)
      .map((p) => p.recipient_id)
  );
  for (const rid of Array.from(keyedRecipients)) {
    const registered = new Set(await getPublicKeys(rid));
    for (const part of clean) {
      if (
        part.recipient_id === rid &&
        part.proto !== SIG1 &&
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
