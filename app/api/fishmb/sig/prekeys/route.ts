// /api/fishmb/sig/prekeys — my own device's one-time prekey pool.
// GET ?device_id=: how many unused one-time prekeys my device has left.
// POST: replenish the pool and/or rotate my signed prekey.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import {
  getDevice,
  countUnusedPrekeys,
  addOneTimePrekeys,
  putSignedPrekey,
} from "@/lib/fish/signal";
import {
  isValidDeviceId,
  parseDeviceIdParam,
  parseSignedPrekey,
  parseOneTimePrekeys,
} from "@/lib/fish/signal-http";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const deviceId = parseDeviceIdParam(new URL(req.url).searchParams.get("device_id"));
  if (deviceId === null) return badRequest("Invalid device id.");
  const device = await getDevice(me.id, deviceId);
  if (!device) return badRequest("Device is not registered.");
  return NextResponse.json({ remaining: await countUnusedPrekeys(me.id, deviceId) });
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
  if (!isValidDeviceId(body.device_id)) return badRequest("Invalid device id.");
  const device = await getDevice(me.id, body.device_id);
  if (!device) return badRequest("Device is not registered.");
  if (body.one_time_prekeys === undefined && body.signed_prekey === undefined) {
    return badRequest("Nothing to update.");
  }
  if (body.one_time_prekeys !== undefined) {
    const keys = parseOneTimePrekeys(body.one_time_prekeys);
    if (!keys) return badRequest("Invalid one-time prekeys.");
    await addOneTimePrekeys(me.id, body.device_id, keys);
  }
  if (body.signed_prekey !== undefined) {
    const signed = parseSignedPrekey(body.signed_prekey);
    if (!signed) return badRequest("Invalid signed prekey.");
    await putSignedPrekey(me.id, body.device_id, signed);
  }
  return NextResponse.json({ remaining: await countUnusedPrekeys(me.id, body.device_id) });
}
