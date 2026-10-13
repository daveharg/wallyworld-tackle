// Device lifecycle: one Ed25519 identity per (user, browser context),
// created exactly once and never silently regenerated.
//
// The localStorage marker `fishmb-sig-device-${userId}` remembers which
// deviceId + storeTag this browser context owns. The storeTag also lives
// in the SignalStore meta under "storeTag". If the store has an identity
// we trust it (marker is rewritten to match). If the marker exists but
// the store has NO identity, the store was wiped (IndexedDB cleared) —
// we mint a BRAND-NEW device (new deviceId, new identity); the old
// identity is never resurrected, and the caller can offer backup restore
// for the old deviceId instead.

import { b64 } from "./bytes";
import {
  edGenerate,
  edSign,
  randomBytes,
  xGenerate,
} from "./crypto";
import type {
  IdentityRecord,
  OneTimePreKeyRecord,
  SignalStore,
  SignedPreKeyRecord,
} from "./types";
import type { RegisterDevicePayload } from "./transport";

/** How many one-time prekeys a fresh device generates. */
export const INITIAL_ONE_TIME_PREKEYS = 100;

export interface DeviceMarker {
  deviceId: number;
  storeTag: string;
}

export interface LoadOrCreateResult {
  identity: IdentityRecord;
  status: "fresh" | "ok" | "wiped";
  isNewIdentity: boolean;
  /** When status is "wiped": the deviceId the marker pointed at before. */
  oldDeviceId?: number;
}

// ------------------------------------------------------------ marker (localStorage)

function markerKey(userId: string): string {
  return `fishmb-sig-device-${userId}`;
}

export function readDeviceMarker(userId: string): DeviceMarker | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(markerKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceMarker>;
    if (typeof parsed.deviceId !== "number") return null;
    return {
      deviceId: parsed.deviceId,
      storeTag: typeof parsed.storeTag === "string" ? parsed.storeTag : "",
    };
  } catch {
    return null;
  }
}

function writeDeviceMarker(userId: string, marker: DeviceMarker): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(markerKey(userId), JSON.stringify(marker));
  } catch {
    // Private-mode storage failures must not break messaging setup;
    // the store itself remains the source of truth.
  }
}

/** Rewrite the localStorage marker so it matches the store's identity
 *  (creating the meta "storeTag" first if the store doesn't have one). */
export async function syncMarker(
  store: SignalStore,
  userId: string
): Promise<void> {
  const identity = await store.getIdentity();
  if (!identity) return;
  let tag = await store.getMeta("storeTag");
  if (!tag) {
    tag = b64(randomBytes(16));
    await store.setMeta("storeTag", tag);
  }
  writeDeviceMarker(userId, { deviceId: identity.deviceId, storeTag: tag });
}

// ------------------------------------------------------------ meta counters

async function metaInt(
  store: SignalStore,
  key: string,
  fallback: number
): Promise<number> {
  const raw = await store.getMeta(key);
  const n = raw == null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

// ------------------------------------------------------------ random ids

function randomDeviceId(exclude?: number): number {
  for (;;) {
    const bytes = randomBytes(4);
    const n =
      ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) &
      0x7fffffff;
    if (n >= 1 && n !== exclude) return n;
  }
}

function randomRegistrationId(): number {
  // 14-bit, 1..16383.
  for (;;) {
    const bytes = randomBytes(2);
    const n = ((bytes[0] << 8) | bytes[1]) & 0x3fff;
    if (n >= 1) return n;
  }
}

// ------------------------------------------------------------ signed prekeys

async function createSignedPreKey(
  store: SignalStore,
  identity: IdentityRecord
): Promise<SignedPreKeyRecord> {
  const keyId = await metaInt(store, "nextSpkId", 1);
  await store.setMeta("nextSpkId", String(keyId + 1));
  const kp = xGenerate();
  const record: SignedPreKeyRecord = {
    keyId,
    pub: kp.pub,
    priv: kp.priv,
    signature: edSign(identity.identityPriv, kp.pub),
    createdAt: Date.now(),
  };
  await store.saveSignedPreKey(record);
  return record;
}

/** The current signed prekey, creating #next if none exists yet. */
export async function ensureSignedPreKey(
  store: SignalStore,
  identity: IdentityRecord
): Promise<SignedPreKeyRecord> {
  const current = await store.getCurrentSignedPreKey();
  if (current) return current;
  return createSignedPreKey(store, identity);
}

/** Create the next signed prekey if the current one is older than
 *  maxAgeMs (old records are kept — peers may still reference them).
 *  Returns the current record after any rotation; compare its keyId
 *  with the pre-call current keyId to detect that a rotation happened. */
export async function rotateSignedPreKeyIfStale(
  store: SignalStore,
  identity: IdentityRecord,
  maxAgeMs: number = 30 * 24 * 60 * 60 * 1000
): Promise<SignedPreKeyRecord> {
  const current = await ensureSignedPreKey(store, identity);
  if (Date.now() - current.createdAt <= maxAgeMs) return current;
  return createSignedPreKey(store, identity);
}

// ------------------------------------------------------------ one-time prekeys

/** Generate `count` fresh one-time prekeys (keyIds from the meta
 *  nextOtpId counter), save them, and return the new records. */
export async function generateOneTimePreKeys(
  store: SignalStore,
  count: number
): Promise<OneTimePreKeyRecord[]> {
  const start = await metaInt(store, "nextOtpId", 1);
  const records: OneTimePreKeyRecord[] = [];
  for (let i = 0; i < count; i++) {
    const kp = xGenerate();
    records.push({ keyId: start + i, pub: kp.pub, priv: kp.priv });
  }
  if (records.length > 0) {
    await store.saveOneTimePreKeys(records);
    await store.setMeta("nextOtpId", String(start + records.length));
  }
  return records;
}

/** Stored one-time prekeys that have not been uploaded to the server yet
 *  (keyId above the meta "otpUploadedThrough" watermark). KeyIds are
 *  issued contiguously, so enumeration is a range scan; records a peer
 *  session already consumed simply read back as missing and are skipped. */
export async function pendingOneTimePreKeys(
  store: SignalStore
): Promise<OneTimePreKeyRecord[]> {
  const through = await metaInt(store, "otpUploadedThrough", 0);
  const next = await metaInt(store, "nextOtpId", 1);
  const out: OneTimePreKeyRecord[] = [];
  for (let keyId = through + 1; keyId < next; keyId++) {
    const rec = await store.getOneTimePreKey(keyId);
    if (rec) out.push(rec);
  }
  return out;
}

/** Advance the uploaded watermark after a successful server POST. */
export async function markOneTimePreKeysUploaded(
  store: SignalStore,
  throughKeyId: number
): Promise<void> {
  const current = await metaInt(store, "otpUploadedThrough", 0);
  if (throughKeyId > current) {
    await store.setMeta("otpUploadedThrough", String(throughKeyId));
  }
}

// ------------------------------------------------------------ fresh device creation

/** Mint a brand-new device in this store: new Ed25519 identity, new
 *  deviceId (never `excludeDeviceId`), fresh counters, signed prekey #1
 *  and the initial one-time prekey pool. Syncs the localStorage marker. */
export async function createFreshDevice(
  store: SignalStore,
  userId: string,
  excludeDeviceId?: number
): Promise<IdentityRecord> {
  const kp = edGenerate();
  const identity: IdentityRecord = {
    userId,
    deviceId: randomDeviceId(excludeDeviceId),
    registrationId: randomRegistrationId(),
    identityPub: kp.pub,
    identityPriv: kp.priv,
    createdAt: Date.now(),
  };
  await store.saveIdentity(identity);
  await store.setMeta("storeTag", b64(randomBytes(16)));
  await store.setMeta("nextSpkId", "1");
  await store.setMeta("nextOtpId", "1");
  await store.setMeta("otpUploadedThrough", "0");
  await ensureSignedPreKey(store, identity);
  await generateOneTimePreKeys(store, INITIAL_ONE_TIME_PREKEYS);
  await syncMarker(store, userId);
  return identity;
}

// ------------------------------------------------------------ lifecycle entry point

export async function loadOrCreateDevice(
  store: SignalStore,
  userId: string
): Promise<LoadOrCreateResult> {
  const existing = await store.getIdentity();
  if (existing) {
    // Trust the store. Rewrite the marker to match it (syncMarker also
    // creates the meta storeTag if this store predates it).
    await syncMarker(store, userId);
    return { identity: existing, status: "ok", isNewIdentity: false };
  }

  const marker = readDeviceMarker(userId);
  if (marker) {
    // Marker says this browser HAD a device, but the store is empty:
    // the store was wiped. Mint a new device — never resurrect the old
    // identity (its private key is gone with the store).
    const identity = await createFreshDevice(store, userId, marker.deviceId);
    return {
      identity,
      status: "wiped",
      isNewIdentity: true,
      oldDeviceId: marker.deviceId,
    };
  }

  const identity = await createFreshDevice(store, userId);
  return { identity, status: "fresh", isNewIdentity: true };
}

// ------------------------------------------------------------ server registration

/** The POST /api/fishmb/sig/devices payload for this store's device:
 *  identity + current signed prekey + every not-yet-uploaded one-time
 *  prekey. Call markOneTimePreKeysUploaded with the max uploaded keyId
 *  after the POST succeeds. */
export async function registrationPayload(
  store: SignalStore,
  identity: IdentityRecord
): Promise<RegisterDevicePayload> {
  const spk = await ensureSignedPreKey(store, identity);
  const pending = await pendingOneTimePreKeys(store);
  return {
    device_id: identity.deviceId,
    identity_key: b64(identity.identityPub),
    registration_id: identity.registrationId,
    signed_prekey: {
      key_id: spk.keyId,
      key: b64(spk.pub),
      signature: b64(spk.signature),
    },
    one_time_prekeys: pending.map((r) => ({
      key_id: r.keyId,
      key: b64(r.pub),
    })),
  };
}
