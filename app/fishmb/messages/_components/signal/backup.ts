// Passphrase-encrypted store backups.
//
// A device's whole SignalStore dump (identity, prekeys, sessions, sent
// log, meta) is encrypted with a key derived from the user's passphrase
// via Argon2id (@noble/hashes) and AES-256-GCM (@noble/ciphers), then
// uploaded to the server. The server additionally requires an Ed25519
// signature by the device identity over backupUploadMessage() so a
// backup blob is bound to (user, device, ciphertext hash).
//
// Wire blob: ciphertext = b64(nonce(12) || AES-GCM ciphertext+tag),
// salt = b64(16 random bytes), kdf = JSON descriptor string.

import { argon2id } from "@noble/hashes/argon2.js";
import { gcm } from "@noble/ciphers/aes.js";
import { b64, concat, hex, unb64, utf8 } from "./bytes";
import { randomBytes, sha256Hash } from "./crypto";
import type { StoreDump } from "./types";

export const BACKUP_KDF_PARAMS = {
  alg: "argon2id",
  t: 2,
  m: 19456, // KiB (~19 MiB)
  p: 1,
} as const;

const DK_LEN = 32;
const SALT_LEN = 16;
const NONCE_LEN = 12;

export interface BackupBlob {
  ciphertext: string;
  salt: string;
  kdf: string;
}

function kdfDescriptor(): string {
  return JSON.stringify({
    alg: BACKUP_KDF_PARAMS.alg,
    t: BACKUP_KDF_PARAMS.t,
    m: BACKUP_KDF_PARAMS.m,
    p: BACKUP_KDF_PARAMS.p,
  });
}

interface KdfSpec {
  t: number;
  m: number;
  p: number;
}

function parseKdf(kdf: string): KdfSpec {
  let parsed: unknown;
  try {
    parsed = JSON.parse(kdf);
  } catch {
    throw new Error("Backup has an unreadable KDF descriptor.");
  }
  const spec = parsed as Partial<{
    alg: string;
    t: number;
    m: number;
    p: number;
  }>;
  if (spec.alg !== "argon2id") {
    throw new Error(`Unsupported backup KDF: ${String(spec.alg)}`);
  }
  return {
    t: typeof spec.t === "number" ? spec.t : BACKUP_KDF_PARAMS.t,
    m: typeof spec.m === "number" ? spec.m : BACKUP_KDF_PARAMS.m,
    p: typeof spec.p === "number" ? spec.p : BACKUP_KDF_PARAMS.p,
  };
}

function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  spec: KdfSpec
): Uint8Array {
  return argon2id(utf8(passphrase), salt, {
    t: spec.t,
    m: spec.m,
    p: spec.p,
    dkLen: DK_LEN,
  });
}

/** Encrypt a store dump under a passphrase. */
export function encryptBackup(dump: StoreDump, passphrase: string): BackupBlob {
  const salt = randomBytes(SALT_LEN);
  const key = deriveKey(passphrase, salt, BACKUP_KDF_PARAMS);
  const nonce = randomBytes(NONCE_LEN);
  const plaintext = utf8(JSON.stringify(dump));
  const ct = gcm(key, nonce).encrypt(plaintext);
  return {
    ciphertext: b64(concat(nonce, ct)),
    salt: b64(salt),
    kdf: kdfDescriptor(),
  };
}

/** Decrypt a backup blob. Throws on a wrong passphrase (GCM auth
 *  failure), a malformed blob, or an unsupported dump version. */
export function decryptBackup(
  blob: { ciphertext: string; salt: string; kdf: string },
  passphrase: string
): StoreDump {
  const spec = parseKdf(blob.kdf);
  const salt = unb64(blob.salt);
  const key = deriveKey(passphrase, salt, spec);
  const raw = unb64(blob.ciphertext);
  if (raw.length <= NONCE_LEN) {
    throw new Error("Backup ciphertext is too short.");
  }
  const nonce = raw.slice(0, NONCE_LEN);
  const ct = raw.slice(NONCE_LEN);
  // Throws on wrong passphrase / tampering (GCM tag mismatch).
  const plaintext = gcm(key, nonce).decrypt(ct);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Backup contents are not valid JSON.");
  }
  const dump = parsed as StoreDump;
  if (!dump || dump.version !== 1) {
    throw new Error(
      `Unsupported backup version: ${String((dump as StoreDump)?.version)}`
    );
  }
  return dump;
}

/** The exact bytes the device identity signs when uploading a backup:
 *  utf8(`fishmb-backup:${userId}:${deviceId}:${hex(sha256(ciphertext))}`). */
export function backupUploadMessage(
  userId: string,
  deviceId: number,
  ciphertextB64: string
): Uint8Array {
  const digest = sha256Hash(unb64(ciphertextB64));
  return utf8(`fishmb-backup:${userId}:${deviceId}:${hex(digest)}`);
}
