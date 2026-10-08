// Client-side E2E crypto for FishMB messages (tweetnacl).
// The private key NEVER leaves this device — it lives in localStorage and
// is never sent to the server. Only the public key is uploaded.

import nacl from "tweetnacl";

const PRIV_KEY_STORAGE = "fishmb-msg-privkey";

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

/** Load the device keypair, generating and storing one if absent. */
export function getOrCreateKeypair(): MsgKeypair {
  try {
    const stored = localStorage.getItem(PRIV_KEY_STORAGE);
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
    localStorage.setItem(PRIV_KEY_STORAGE, bytesToB64(kp.secretKey));
  } catch {
    // storage unavailable — keys live for this session only
  }
  return kp;
}

export function hasLocalKeypair(): boolean {
  try {
    const stored = localStorage.getItem(PRIV_KEY_STORAGE);
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
