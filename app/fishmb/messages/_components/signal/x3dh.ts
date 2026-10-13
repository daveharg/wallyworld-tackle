// X3DH (Extended Triple Diffie-Hellman, Signal specification) — agrees
// the initial shared secret that seeds the Double Ratchet's root key,
// asynchronously, from a fetched prekey bundle.
//
// DH order (initiator's perspective):
//   DH1 = DH(IK_A priv, SPK_B)      — initiator identity x responder SPK
//   DH2 = DH(EK_A priv, IK_B)       — ephemeral x responder identity
//   DH3 = DH(EK_A priv, SPK_B)      — ephemeral x responder SPK
//   DH4 = DH(EK_A priv, OPK_B)      — ephemeral x one-time prekey (if any)
// The responder mirrors every term with the private key it holds, so
// both sides compute the identical concatenation.
//
// SK = HKDF-SHA256( F || DH1 || DH2 || DH3 [|| DH4] ), where F is 32
// bytes of 0xFF (domain separation for the identity DHs, per the spec),
// salt is 32 zero bytes, info is our protocol string.
//
// Identities live on Ed25519; X3DH needs them in X25519 form, so both
// sides convert via the standard birational map (crypto.ts). The
// associated data for the ratchet is concat(IK_A, IK_B) in X25519 form,
// initiator first — binding every message to both identities.

import { unb64, utf8, concat } from "./bytes";
import {
  xGenerate,
  xDH,
  edVerify,
  edPubToX,
  edPrivToX,
  hkdf,
  type KeyPair,
} from "./crypto";
import {
  DecryptFailure,
  type IdentityRecord,
  type PreKeyBundle,
} from "./types";

export const X3DH_INFO = "FishMBSignalX3DH";

const ZERO_SALT = new Uint8Array(32);
/** F: 32 bytes of 0xFF prefixed to the DH concatenation, per the spec. */
const F_PREFIX = new Uint8Array(32).fill(0xff);

function deriveSk(dhs: Uint8Array[]): Uint8Array {
  let ikm = F_PREFIX;
  ikm = concat(ikm, ...dhs);
  return hkdf(ikm, ZERO_SALT, utf8(X3DH_INFO), 32);
}

function mustDh(priv: Uint8Array, pub: Uint8Array, which: string): Uint8Array {
  const out = xDH(priv, pub);
  if (!out) {
    throw new DecryptFailure("desync", `X3DH ${which} failed (low-order key)`);
  }
  return out;
}

export interface X3dhInitResult {
  /** Shared secret — becomes Alice's root-key input / Bob's root key. */
  sk: Uint8Array;
  /** Fresh ephemeral keypair; its public half travels in the PreKeyMessage. */
  ephemeral: KeyPair;
  /** concat(myIdXPub, theirIdXPub). */
  ad: Uint8Array;
}

export function initiateX3dh(
  myIdentity: IdentityRecord,
  bundle: PreKeyBundle,
): X3dhInitResult {
  const theirIdEdPub = unb64(bundle.identityKey);
  const spkPub = unb64(bundle.signedPreKey.key);
  const signature = unb64(bundle.signedPreKey.signature);

  // Authenticate the signed prekey BEFORE any DH: an unsigned/forged
  // SPK would let a server (or attacker) substitute its own key and
  // silently MITM the session.
  if (!edVerify(signature, spkPub, theirIdEdPub)) {
    throw new DecryptFailure(
      "bad-signature",
      "signed prekey signature verification failed",
    );
  }

  const myIdXPriv = edPrivToX(myIdentity.identityPriv);
  const myIdXPub = edPubToX(myIdentity.identityPub);
  const theirIdXPub = edPubToX(theirIdEdPub);

  const ephemeral = xGenerate();

  const dhs: Uint8Array[] = [
    mustDh(myIdXPriv, spkPub, "DH1"),
    mustDh(ephemeral.priv, theirIdXPub, "DH2"),
    mustDh(ephemeral.priv, spkPub, "DH3"),
  ];
  if (bundle.oneTimePreKey) {
    dhs.push(
      mustDh(ephemeral.priv, unb64(bundle.oneTimePreKey.key), "DH4"),
    );
  }

  return {
    sk: deriveSk(dhs),
    ephemeral,
    ad: concat(myIdXPub, theirIdXPub),
  };
}

export interface X3dhRespondResult {
  sk: Uint8Array;
  /** concat(theirIdXPub, myIdXPub) — initiator first, as on Alice's side. */
  ad: Uint8Array;
}

/**
 * Responder mirror of initiateX3dh. `theirIdentityEdPub` /
 * `theirEphemeralXPub` come from the incoming PreKeyMessage envelope.
 * `myOpkPriv` must be the private half of the one-time prekey the
 * envelope names, or null when it names none.
 */
export function respondX3dh(
  myIdentity: IdentityRecord,
  mySpkPriv: Uint8Array,
  myOpkPriv: Uint8Array | null,
  theirIdentityEdPub: Uint8Array,
  theirEphemeralXPub: Uint8Array,
): X3dhRespondResult {
  const myIdXPriv = edPrivToX(myIdentity.identityPriv);
  const myIdXPub = edPubToX(myIdentity.identityPub);
  const theirIdXPub = edPubToX(theirIdentityEdPub);

  const dhs: Uint8Array[] = [
    // DH1 mirrored: our SPK private x their identity.
    mustDh(mySpkPriv, theirIdXPub, "DH1"),
    // DH2 mirrored: our identity private x their ephemeral.
    mustDh(myIdXPriv, theirEphemeralXPub, "DH2"),
    // DH3 mirrored: our SPK private x their ephemeral.
    mustDh(mySpkPriv, theirEphemeralXPub, "DH3"),
  ];
  if (myOpkPriv) {
    dhs.push(mustDh(myOpkPriv, theirEphemeralXPub, "DH4"));
  }

  return {
    sk: deriveSk(dhs),
    ad: concat(theirIdXPub, myIdXPub),
  };
}
