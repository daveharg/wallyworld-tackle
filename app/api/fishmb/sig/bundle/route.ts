// /api/fishmb/sig/bundle — fetch a device's prekey bundle to start a
// Signal session. Claiming the bundle consumes one one-time prekey
// (atomically, in lib/fish/signal.ts) when the device still has any.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, notFound } from "@/lib/fish/auth";
import { getBundle } from "@/lib/fish/signal";
import { UUIDISH, parseDeviceIdParam } from "@/lib/fish/signal-http";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const params = new URL(req.url).searchParams;
  const userId = params.get("user_id") ?? "";
  if (!UUIDISH.test(userId)) return badRequest("Invalid user id.");
  const deviceId = parseDeviceIdParam(params.get("device_id"));
  if (deviceId === null) return badRequest("Invalid device id.");
  const bundle = await getBundle(userId, deviceId);
  if (!bundle) return notFound("Device not found.");
  return NextResponse.json({
    userId,
    deviceId,
    registrationId: bundle.registration_id,
    identityKey: bundle.identity_key_pub,
    signedPreKey: {
      keyId: bundle.signed_prekey.key_id,
      key: bundle.signed_prekey.public_key,
      signature: bundle.signed_prekey.signature,
    },
    oneTimePreKey: bundle.one_time_prekey
      ? {
          keyId: bundle.one_time_prekey.key_id,
          key: bundle.one_time_prekey.public_key,
        }
      : null,
  });
}
