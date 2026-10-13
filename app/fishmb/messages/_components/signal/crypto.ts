// Cryptographic primitives for the Signal protocol layer, built ONLY on
// the audited @noble libraries (no GPL code, no hand-rolled curves).
//
// Primitive assignment (per Signal's public X3DH / Double Ratchet specs):
// - X25519 for all Diffie-Hellman (ratchet keys, prekeys, ephemeral keys).
// - Ed25519 for signed-prekey signatures. A device identity is ONE Ed25519
//   keypair; for X3DH the identity key is used in Montgomery (X25519)
//   form via the standard birational conversion (edwardsToMontgomery),
//   which noble exposes as utils.toMontgomery / toMontgomerySecret. The
//   public identity key stored on the server is the Ed25519 public key;
//   its X25519 form is derived deterministically wherever DH needs it:
//   x25519.getPublicKey(toMontgomerySecret(seed)) === toMontgomery(pub).
// - HKDF-SHA256 and HMAC-SHA256 for the ratchet KDF chains.
// - AES-256-CBC with PKCS#7 padding (@noble/ciphers applies/verifies
//   PKCS#7 in its cbc mode) + HMAC-SHA256 message authentication.

import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf as nobleHkdf } from "@noble/hashes/hkdf.js";
import { hmac as nobleHmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes as nobleRandom } from "@noble/hashes/utils.js";
import { cbc } from "@noble/ciphers/aes.js";

export interface KeyPair {
  pub: Uint8Array;
  priv: Uint8Array;
}

export function randomBytes(n: number): Uint8Array {
  return nobleRandom(n);
}

// ---------------------------------------------------------------- X25519

export function xGenerate(): KeyPair {
  const kp = x25519.keygen();
  return { pub: kp.publicKey, priv: kp.secretKey };
}

export function xPubFromPriv(priv: Uint8Array): Uint8Array {
  return x25519.getPublicKey(priv);
}

/** X25519 DH. Returns null on failure (e.g. low-order input) instead of
 *  throwing, so protocol code can map it to a typed decrypt error. */
export function xDH(priv: Uint8Array, pub: Uint8Array): Uint8Array | null {
  try {
    if (priv.length !== 32 || pub.length !== 32) return null;
    const out = x25519.getSharedSecret(priv, pub);
    // An all-zero output means the peer supplied a low-order point.
    if (out.every((b) => b === 0)) return null;
    return out;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- Ed25519

export function edGenerate(): KeyPair {
  const kp = ed25519.keygen();
  return { pub: kp.publicKey, priv: kp.secretKey };
}

export function edPubFromPriv(priv: Uint8Array): Uint8Array {
  return ed25519.getPublicKey(priv);
}

export function edSign(priv: Uint8Array, msg: Uint8Array): Uint8Array {
  return ed25519.sign(msg, priv);
}

export function edVerify(sig: Uint8Array, msg: Uint8Array, pub: Uint8Array): boolean {
  try {
    if (sig.length !== 64 || pub.length !== 32) return false;
    return ed25519.verify(sig, msg, pub);
  } catch {
    return false;
  }
}

/** Montgomery (X25519) encoding of an Ed25519 public key. */
export function edPubToX(edPub: Uint8Array): Uint8Array {
  return ed25519.utils.toMontgomery(edPub);
}

/** Montgomery (X25519) private key for an Ed25519 secret seed. */
export function edPrivToX(edPrivSeed: Uint8Array): Uint8Array {
  return ed25519.utils.toMontgomerySecret(edPrivSeed);
}

// ---------------------------------------------------------------- Hashes / KDF

export function sha256Hash(data: Uint8Array): Uint8Array {
  return sha256(data);
}

/** HKDF-SHA256 (extract + expand), per RFC 5869 / spec usage. */
export function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number): Uint8Array {
  return nobleHkdf(sha256, ikm, salt, info, len);
}

/** HMAC-SHA256. */
export function hmac(key: Uint8Array, data: Uint8Array): Uint8Array {
  return nobleHmac(sha256, key, data);
}

// ---------------------------------------------------------------- AES-CBC

/** AES-256-CBC encrypt with PKCS#7 padding (noble's cbc pads/unpads). */
export function aesCbcEncrypt(key: Uint8Array, iv: Uint8Array, plaintext: Uint8Array): Uint8Array {
  return cbc(key, iv).encrypt(plaintext);
}

/** AES-256-CBC decrypt; throws on bad padding / wrong key. */
export function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Uint8Array {
  return cbc(key, iv).decrypt(ciphertext);
}
