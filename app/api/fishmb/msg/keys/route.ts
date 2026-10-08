// /api/fishmb/msg/keys — my own messaging public key.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { getPublicKey, setPublicKey } from "@/lib/fish/messages";

const B64 = /^[A-Za-z0-9+/=]+$/;

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  return NextResponse.json({ public_key: await getPublicKey(me.id) });
}

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const pk = typeof body.public_key === "string" ? body.public_key.trim() : "";
  // X25519 public keys are 32 bytes -> 44 base64 chars.
  if (!B64.test(pk) || pk.length !== 44) return badRequest("Invalid public key.");
  await setPublicKey(me.id, pk);
  return NextResponse.json({ ok: true });
}
