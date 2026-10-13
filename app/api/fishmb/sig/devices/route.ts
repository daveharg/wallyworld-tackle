// /api/fishmb/sig/devices — Signal device registration + device listing.
// POST: register my device (identity key, signed prekey, one-time prekeys).
// GET ?user_id=: list a user's registered devices (public material only).
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { registerDevice, listDevices, isB64Key } from "@/lib/fish/signal";
import {
  UUIDISH,
  isValidDeviceId,
  parseSignedPrekey,
  parseOneTimePrekeys,
} from "@/lib/fish/signal-http";

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  if (!isValidDeviceId(body.device_id)) return badRequest("Invalid device id.");
  const registrationId = body.registration_id;
  if (
    typeof registrationId !== "number" ||
    !Number.isInteger(registrationId) ||
    registrationId < 1 ||
    registrationId > 16383
  )
    return badRequest("Invalid registration id.");
  const identityKey =
    typeof body.identity_key === "string" ? body.identity_key.trim() : "";
  if (!isB64Key(identityKey)) return badRequest("Invalid identity key.");
  const signedPrekey = parseSignedPrekey(body.signed_prekey);
  if (!signedPrekey) return badRequest("Invalid signed prekey.");
  const oneTimePrekeys = parseOneTimePrekeys(body.one_time_prekeys);
  if (!oneTimePrekeys) return badRequest("Invalid one-time prekeys.");

  const result = await registerDevice(me.id, {
    device_id: body.device_id,
    identity_key: identityKey,
    registration_id: registrationId,
    signed_prekey: signedPrekey,
    one_time_prekeys: oneTimePrekeys,
  });
  if (result.status === "identity-conflict") {
    return badRequest("This device is already registered with a different identity.");
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const userId = new URL(req.url).searchParams.get("user_id") ?? "";
  if (!UUIDISH.test(userId)) return badRequest("Invalid user id.");
  const devices = await listDevices(userId);
  return NextResponse.json({
    devices: devices.map((d) => ({
      device_id: d.device_id,
      identity_key: d.identity_key_pub,
      registration_id: d.registration_id,
    })),
  });
}
