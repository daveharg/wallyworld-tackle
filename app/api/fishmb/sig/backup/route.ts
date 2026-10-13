// /api/fishmb/sig/backup — my own device's encrypted Signal backup.
// The ciphertext is opaque to the server; uploads must be signed with
// the device's Ed25519 identity key (see verifyBackupSignature).
// GET ?device_id=: metadata. GET ?device_id=&download=1: the blob.
// PUT: store a new backup after signature verification.
import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest } from "@/lib/fish/auth";
import { getDevice, getBackup, putBackup, verifyBackupSignature } from "@/lib/fish/signal";
import { isValidDeviceId, parseDeviceIdParam } from "@/lib/fish/signal-http";

const MAX_CIPHERTEXT_CHARS = 2_000_000;

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const params = new URL(req.url).searchParams;
  const deviceId = parseDeviceIdParam(params.get("device_id"));
  if (deviceId === null) return badRequest("Invalid device id.");
  // Scoped to me.id: only ever my own backups are visible here.
  const backup = await getBackup(me.id, deviceId);
  if (params.get("download") === "1") {
    if (!backup) return NextResponse.json({ exists: false });
    return NextResponse.json({
      ciphertext: backup.ciphertext,
      salt: backup.salt,
      kdf: backup.kdf,
      device_id: deviceId,
    });
  }
  return NextResponse.json({
    exists: !!backup,
    updated_at: backup?.updated_at ?? null,
    device_id: deviceId,
  });
}

export async function PUT(req: NextRequest) {
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
  const ciphertext = typeof body.ciphertext === "string" ? body.ciphertext : "";
  if (!ciphertext || ciphertext.length > MAX_CIPHERTEXT_CHARS) {
    return badRequest("Invalid backup ciphertext.");
  }
  const salt = typeof body.salt === "string" ? body.salt : "";
  const kdf = typeof body.kdf === "string" ? body.kdf : "";
  if (!salt || salt.length > 1024 || !kdf || kdf.length > 1024) {
    return badRequest("Invalid backup parameters.");
  }
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  const valid = verifyBackupSignature(
    device.identity_key_pub,
    me.id,
    body.device_id,
    ciphertext,
    signature
  );
  if (!valid) return badRequest("Invalid backup signature.");
  await putBackup(me.id, body.device_id, { ciphertext, salt, kdf });
  return NextResponse.json({ ok: true });
}
