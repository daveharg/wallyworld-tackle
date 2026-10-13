// FishMB Signal-protocol device / prekey server store.
//
// The server is a dumb relay for Signal key material: it stores each
// device's identity key, its current signed prekey, a pool of one-time
// prekeys, and (optionally) an encrypted, client-signed backup blob.
// All Signal cryptography (X3DH, Double Ratchet, identity keys) happens
// on the clients; this layer only stores and hands out public bundles,
// claiming one-time prekeys atomically so two sessions can never be
// handed the same one. Private keys and plaintext never touch it.

import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { query, queryOne } from "./db";

// ------------------------------------------------------------------
// Shapes

export interface SigSignedPrekeyInput {
  key_id: number;
  /** Base64 public key (32 bytes -> 44 chars). */
  key: string;
  /** Base64 Ed25519 signature over the key (64 bytes -> 88 chars). */
  signature: string;
}

export interface SigOneTimePrekeyInput {
  key_id: number;
  /** Base64 public key (32 bytes -> 44 chars). */
  key: string;
}

export interface RegisterDeviceInput {
  device_id: number;
  /** Base64 identity public key (32 bytes -> 44 chars). */
  identity_key: string;
  registration_id: number;
  signed_prekey: SigSignedPrekeyInput;
  one_time_prekeys: SigOneTimePrekeyInput[];
}

export type RegisterDeviceResult = { status: "ok" } | { status: "identity-conflict" };

export interface SigDevice {
  user_id: string;
  device_id: number;
  identity_key_pub: string;
  registration_id: number;
  created_at: string;
  last_seen: string;
}

export interface SigBundle {
  registration_id: number;
  identity_key_pub: string;
  signed_prekey: { key_id: number; public_key: string; signature: string };
  one_time_prekey: { key_id: number; public_key: string } | null;
}

export interface SigBackup {
  user_id: string;
  device_id: number;
  ciphertext: string;
  salt: string;
  kdf: string;
  updated_at: string;
}

// ------------------------------------------------------------------
// Validation + encoding helpers (local on purpose — the server module
// must not depend on the client signal/ code).

const B64 = /^[A-Za-z0-9+/=]+$/;

/** True for a base64 string decoding to exactly 32 bytes (44 chars). */
export function isB64Key(s: unknown): s is string {
  return typeof s === "string" && B64.test(s) && s.length === 44;
}

/** True for a base64 string decoding to exactly 64 bytes (88 chars). */
export function isB64Signature(s: unknown): s is string {
  return typeof s === "string" && B64.test(s) && s.length === 88;
}

function b64ToBytes(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// ------------------------------------------------------------------
// Tables

let ensured = false;

export async function ensureSigTables(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS sig_devices (
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    device_id int NOT NULL,
    identity_key_pub text NOT NULL,
    registration_id int NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, device_id)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS sig_signed_prekeys (
    user_id uuid NOT NULL,
    device_id int NOT NULL,
    key_id int NOT NULL,
    public_key text NOT NULL,
    signature text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, device_id, key_id)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS sig_one_time_prekeys (
    user_id uuid NOT NULL,
    device_id int NOT NULL,
    key_id int NOT NULL,
    public_key text NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, device_id, key_id)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS sig_backups (
    user_id uuid NOT NULL,
    device_id int NOT NULL,
    ciphertext text NOT NULL,
    salt text NOT NULL,
    kdf text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, device_id)
  )`);
  ensured = true;
}

// ------------------------------------------------------------------
// Devices

export async function getDevice(
  userId: string,
  deviceId: number
): Promise<SigDevice | null> {
  await ensureSigTables();
  return queryOne<SigDevice>(
    `SELECT user_id, device_id, identity_key_pub, registration_id, created_at, last_seen
       FROM sig_devices
      WHERE user_id = $1 AND device_id = $2`,
    [userId, deviceId]
  );
}

export async function listDevices(
  userId: string
): Promise<{ device_id: number; identity_key_pub: string; registration_id: number }[]> {
  await ensureSigTables();
  return query<{ device_id: number; identity_key_pub: string; registration_id: number }>(
    `SELECT device_id, identity_key_pub, registration_id
       FROM sig_devices
      WHERE user_id = $1
      ORDER BY device_id ASC`,
    [userId]
  );
}

/** True when identityKeyB64 is the registered identity key of ANY of the
 *  user's Signal devices. Used to check a sig1 message copy is addressed
 *  to a real device identity before relaying it. */
export async function isDeviceIdentity(
  userId: string,
  identityKeyB64: string
): Promise<boolean> {
  await ensureSigTables();
  const row = await queryOne<{ n: string }>(
    `SELECT 1 AS n FROM sig_devices
      WHERE user_id = $1 AND identity_key_pub = $2`,
    [userId, identityKeyB64]
  );
  return !!row;
}

/**
 * Register (or re-register) a device with its full key material.
 * A device id already bound to a DIFFERENT identity key is a conflict:
 * nothing is written — identity keys are the trust anchor and are never
 * silently replaced server-side.
 */
export async function registerDevice(
  userId: string,
  input: RegisterDeviceInput
): Promise<RegisterDeviceResult> {
  await ensureSigTables();
  const existing = await getDevice(userId, input.device_id);
  if (existing && existing.identity_key_pub !== input.identity_key) {
    return { status: "identity-conflict" };
  }
  await query(
    `INSERT INTO sig_devices (user_id, device_id, identity_key_pub, registration_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [userId, input.device_id, input.identity_key, input.registration_id]
  );
  await putSignedPrekey(userId, input.device_id, input.signed_prekey);
  await addOneTimePrekeys(userId, input.device_id, input.one_time_prekeys);
  await query(
    `UPDATE sig_devices SET last_seen = now()
      WHERE user_id = $1 AND device_id = $2`,
    [userId, input.device_id]
  );
  return { status: "ok" };
}

// ------------------------------------------------------------------
// Prekeys

/** Upsert a signed prekey. Rotation adds a new key_id row; old rows are
 *  kept so in-flight sessions started against them can still be built. */
export async function putSignedPrekey(
  userId: string,
  deviceId: number,
  signedPrekey: SigSignedPrekeyInput
): Promise<void> {
  await ensureSigTables();
  await query(
    `INSERT INTO sig_signed_prekeys (user_id, device_id, key_id, public_key, signature)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, device_id, key_id)
       DO UPDATE SET public_key = EXCLUDED.public_key,
                     signature = EXCLUDED.signature`,
    [userId, deviceId, signedPrekey.key_id, signedPrekey.key, signedPrekey.signature]
  );
}

/** Add one-time prekeys; key_ids already present are left untouched
 *  (in particular a used key can never be resurrected by a re-upload). */
export async function addOneTimePrekeys(
  userId: string,
  deviceId: number,
  keys: SigOneTimePrekeyInput[]
): Promise<void> {
  await ensureSigTables();
  for (const k of keys) {
    await query(
      `INSERT INTO sig_one_time_prekeys (user_id, device_id, key_id, public_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [userId, deviceId, k.key_id, k.key]
    );
  }
}

export async function countUnusedPrekeys(
  userId: string,
  deviceId: number
): Promise<number> {
  await ensureSigTables();
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM sig_one_time_prekeys
      WHERE user_id = $1 AND device_id = $2 AND used_at IS NULL`,
    [userId, deviceId]
  );
  return row?.n ?? 0;
}

/**
 * Fetch a device's prekey bundle for starting a session. The one-time
 * prekey is CLAIMED atomically: a single UPDATE marks the lowest unused
 * key used and returns it, so concurrent bundle fetches can never hand
 * the same one-time prekey to two different sessions. Returns null when
 * the device (or its signed prekey) does not exist.
 */
export async function getBundle(
  userId: string,
  deviceId: number
): Promise<SigBundle | null> {
  await ensureSigTables();
  const device = await getDevice(userId, deviceId);
  if (!device) return null;
  const signed = await queryOne<{ key_id: number; public_key: string; signature: string }>(
    `SELECT key_id, public_key, signature
       FROM sig_signed_prekeys
      WHERE user_id = $1 AND device_id = $2
      ORDER BY key_id DESC
      LIMIT 1`,
    [userId, deviceId]
  );
  if (!signed) return null;
  const claimed = await queryOne<{ key_id: number; public_key: string }>(
    `UPDATE sig_one_time_prekeys
        SET used_at = now()
      WHERE (user_id, device_id, key_id) = (
        SELECT user_id, device_id, key_id
          FROM sig_one_time_prekeys
         WHERE user_id = $1 AND device_id = $2 AND used_at IS NULL
         ORDER BY key_id ASC
         LIMIT 1
      )
      RETURNING key_id, public_key`,
    [userId, deviceId]
  );
  return {
    registration_id: device.registration_id,
    identity_key_pub: device.identity_key_pub,
    signed_prekey: {
      key_id: signed.key_id,
      public_key: signed.public_key,
      signature: signed.signature,
    },
    one_time_prekey: claimed
      ? { key_id: claimed.key_id, public_key: claimed.public_key }
      : null,
  };
}

// ------------------------------------------------------------------
// Encrypted backups
//
// The backup ciphertext is opaque to the server. The upload is signed
// with the device's Ed25519 identity key over a domain-separated digest
// message so a backup can only ever be replaced by the device itself:
//   "fishmb-backup:<userId>:<deviceId>:<hex(sha256(ciphertext bytes))>"

export async function getBackup(
  userId: string,
  deviceId: number
): Promise<SigBackup | null> {
  await ensureSigTables();
  return queryOne<SigBackup>(
    `SELECT user_id, device_id, ciphertext, salt, kdf, updated_at
       FROM sig_backups
      WHERE user_id = $1 AND device_id = $2`,
    [userId, deviceId]
  );
}

export async function putBackup(
  userId: string,
  deviceId: number,
  backup: { ciphertext: string; salt: string; kdf: string }
): Promise<void> {
  await ensureSigTables();
  await query(
    `INSERT INTO sig_backups (user_id, device_id, ciphertext, salt, kdf)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, device_id)
       DO UPDATE SET ciphertext = EXCLUDED.ciphertext,
                     salt = EXCLUDED.salt,
                     kdf = EXCLUDED.kdf,
                     updated_at = now()`,
    [userId, deviceId, backup.ciphertext, backup.salt, backup.kdf]
  );
}

/** Verify a backup upload signature against a device identity key. */
export function verifyBackupSignature(
  identityPubB64: string,
  userId: string,
  deviceId: number,
  ciphertextB64: string,
  signatureB64: string
): boolean {
  try {
    if (!isB64Key(identityPubB64) || !isB64Signature(signatureB64)) return false;
    const publicKey = b64ToBytes(identityPubB64);
    const signature = b64ToBytes(signatureB64);
    if (publicKey.length !== 32 || signature.length !== 64) return false;
    const digest = sha256(b64ToBytes(ciphertextB64));
    const message = new TextEncoder().encode(
      `fishmb-backup:${userId}:${deviceId}:${bytesToHex(digest)}`
    );
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}
