// Client-side E2E crypto for FishMB messages (tweetnacl).
// Private keys NEVER leave this device — they live in localStorage and
// are never sent to the server. Only public keys are uploaded, and the
// server keeps several per user (add-only), so a fresh device/context
// registering its key can never orphan older messages.
//
// Two copy formats:
// - v2 (current): self-contained per-copy envelope. A random message
//   key encrypts the plaintext (secretbox); the key is wrapped to ONE
//   recipient public key with nacl.box under a FRESH ephemeral keypair.
//   Decryption needs only the recipient's own secret key — the sender's
//   key state doesn't matter. The copy's nonce field is the literal
//   string "v2" and the ciphertext field is a JSON envelope.
// - legacy: pairwise ECDH shared secret (sender pub x recipient secret)
//   + secretbox, nonce/ciphertext are plain base64. Copies written
//   before v2 still decrypt client-side by trying the sender's
//   registered keys, newest first.

import nacl from "tweetnacl";

const PRIV_KEY_PREFIX = "fishmb-msg-privkey-";

function keyFor(userId: string): string {
  return `${PRIV_KEY_PREFIX}${userId}`;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export interface MsgKeypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/** Load the device keypair for a user, generating and storing one if absent. */
export function getOrCreateKeypair(userId: string): MsgKeypair {
  try {
    const stored = localStorage.getItem(keyFor(userId));
    if (stored) {
      const secretKey = b64ToBytes(stored);
      if (secretKey.length === nacl.box.secretKeyLength) {
        return nacl.box.keyPair.fromSecretKey(secretKey);
      }
    }
  } catch {
    // fall through to generation
  }
  const kp = nacl.box.keyPair();
  try {
    localStorage.setItem(keyFor(userId), bytesToB64(kp.secretKey));
  } catch {
    // storage unavailable — keys live for this session only
  }
  return kp;
}

export function hasLocalKeypair(userId: string): boolean {
  try {
    const stored = localStorage.getItem(keyFor(userId));
    return !!stored && b64ToBytes(stored).length === nacl.box.secretKeyLength;
  } catch {
    return false;
  }
}

export function publicKeyB64(kp: MsgKeypair): string {
  return bytesToB64(kp.publicKey);
}

/** Shared secret for a 1:1 conversation (ECDH). Same on both sides. */
export function sharedSecret(theirPublicB64: string, mySecret: Uint8Array): Uint8Array {
  return nacl.box.before(b64ToBytes(theirPublicB64), mySecret);
}

export function encryptText(
  plain: string,
  shared: Uint8Array
): { nonce: string; ciphertext: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const box = nacl.secretbox(new TextEncoder().encode(plain), nonce, shared);
  return { nonce: bytesToB64(nonce), ciphertext: bytesToB64(box) };
}

/** Returns null when decryption fails (wrong key / tampered). */
export function decryptText(
  nonceB64: string,
  ciphertextB64: string,
  shared: Uint8Array
): string | null {
  try {
    const opened = nacl.secretbox.open(
      b64ToBytes(ciphertextB64),
      b64ToBytes(nonceB64),
      shared
    );
    return opened ? new TextDecoder().decode(opened) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// v2 self-contained copies (pure functions over Uint8Array + base64 — no
// browser globals beyond btoa/atob, so they can be exercised from node).
// ---------------------------------------------------------------------------

/** The nonce-field marker that identifies a v2 copy. */
export const V2_NONCE = "v2";

export interface V2Envelope {
  v: 2;
  /** Ephemeral public key (base64) the message key was wrapped under. */
  e: string;
  /** Wrap nonce (base64). */
  wn: string;
  /** Wrapped message key (base64 nacl.box output). */
  w: string;
  /** Message nonce (base64). */
  mn: string;
  /** Secretbox ciphertext of the plaintext under the message key (base64). */
  c: string;
}

/**
 * Encrypt `plain` for ONE recipient public key, producing a copy whose
 * stored fields are { nonce: "v2", ciphertext: <JSON envelope> }.
 * The sender's own keypair plays no part — only the recipient's secret
 * key can open the copy.
 */
export function encryptForPublicKey(
  plain: string,
  recipientPublicB64: string
): { nonce: string; ciphertext: string } {
  const recipientPub = b64ToBytes(recipientPublicB64);
  const msgKey = nacl.randomBytes(nacl.secretbox.keyLength);
  const msgNonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const c = nacl.secretbox(new TextEncoder().encode(plain), msgNonce, msgKey);
  const ephemeral = nacl.box.keyPair();
  const wrapNonce = nacl.randomBytes(nacl.box.nonceLength);
  const w = nacl.box(msgKey, wrapNonce, recipientPub, ephemeral.secretKey);
  const envelope: V2Envelope = {
    v: 2,
    e: bytesToB64(ephemeral.publicKey),
    wn: bytesToB64(wrapNonce),
    w: bytesToB64(w),
    mn: bytesToB64(msgNonce),
    c: bytesToB64(c),
  };
  return { nonce: V2_NONCE, ciphertext: JSON.stringify(envelope) };
}

/**
 * Open a v2 copy with the recipient's own secret key. Returns null when
 * the copy wasn't wrapped to this key or was tampered with.
 */
export function decryptV2Copy(
  nonceField: string,
  ciphertextField: string,
  mySecret: Uint8Array
): string | null {
  if (nonceField !== V2_NONCE) return null;
  try {
    const env = JSON.parse(ciphertextField) as Partial<V2Envelope>;
    if (
      env.v !== 2 ||
      typeof env.e !== "string" ||
      typeof env.wn !== "string" ||
      typeof env.w !== "string" ||
      typeof env.mn !== "string" ||
      typeof env.c !== "string"
    )
      return null;
    const msgKey = nacl.box.open(
      b64ToBytes(env.w),
      b64ToBytes(env.wn),
      b64ToBytes(env.e),
      mySecret
    );
    if (!msgKey) return null;
    const opened = nacl.secretbox.open(
      b64ToBytes(env.c),
      b64ToBytes(env.mn),
      msgKey
    );
    return opened ? new TextDecoder().decode(opened) : null;
  } catch {
    return null;
  }
}
