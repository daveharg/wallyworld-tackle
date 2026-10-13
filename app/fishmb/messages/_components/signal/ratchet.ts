// Double Ratchet (Signal specification, public spec at signal.org/docs)
// — the symmetric + DH ratchet that protects every FishMB message after
// X3DH has established the root key.
//
// Construction notes (the parts that are easy to get subtly wrong):
// - KDF_RK is HKDF-SHA256 with the CURRENT root key as salt and the DH
//   output as IKM, expanded to 64 bytes: (new root key, chain key).
// - KDF_CK is the HMAC chain from the spec: message key =
//   HMAC-SHA256(CK, 0x01), next chain key = HMAC-SHA256(CK, 0x02). The
//   raw message key is never used as an encryption key directly — it is
//   expanded (HKDF, zero salt) into (AES key, HMAC key, IV).
// - Message encryption is AES-256-CBC + HMAC-SHA256 (encrypt-then-MAC,
//   full 32-byte tag appended to the ciphertext). The MAC is verified
//   with a constant-time compare BEFORE any decryption is attempted,
//   and covers the full associated data (session AD || header bytes),
//   so headers cannot be tampered with either.
// - Associated data: `ad` is fixed for the session at X3DH time (the two
//   identity keys in X25519 form, initiator first); per message, the
//   header bytes (ratchet pub || PN || N, big-endian u32s) are appended.
//
// State is kept JSON-serializable at all times (binary fields base64) so
// SessionRecord.state is just JSON.stringify(state). These functions
// MUTATE the state they are given; all-or-nothing semantics on failure
// are the caller's job (SessionManager decrypts on a working copy and
// only persists on success).

import { b64, unb64, utf8, concat, eq, u32be } from "./bytes";
import {
  xGenerate,
  xDH,
  hkdf,
  hmac,
  aesCbcEncrypt,
  aesCbcDecrypt,
  type KeyPair,
} from "./crypto";
import { DecryptFailure, type RatchetHeader } from "./types";

export const RATCHET_INFO = "FishMBSignalRatchet";
export const MESSAGE_KEYS_INFO = "FishMBSignalMessageKeys";

/** Max message keys we will derive across a single gap in a chain. */
export const MAX_SKIP_PER_GAP = 1000;
/** Max skipped (out-of-order) message keys retained per session. */
export const MAX_SKIPPED_KEYS = 1000;

const ZERO_SALT = new Uint8Array(32);

export interface SkippedKey {
  /** Ratchet public key (base64) of the chain this key belongs to. */
  dh: string;
  /** Message number within that chain. */
  n: number;
  /** Message key (base64). */
  mk: string;
}

export interface RatchetState {
  /** Root key (base64). */
  rk: string;
  /** Our current ratchet private key (base64). */
  dhSelfPriv: string;
  /** Our current ratchet public key (base64). */
  dhSelfPub: string;
  /** Peer's current ratchet public key (base64), null until first recv. */
  dhRemote: string | null;
  /** Sending chain key (base64), null until a DH ratchet step creates it. */
  ckSend: string | null;
  /** Receiving chain key (base64), null until a DH ratchet step creates it. */
  ckRecv: string | null;
  /** Messages sent on the current sending chain. */
  nSend: number;
  /** Messages received on the current receiving chain. */
  nRecv: number;
  /** Length of our previous sending chain (sent as PN in headers). */
  pnSend: number;
  skipped: SkippedKey[];
  /** Session associated data (base64): concat of the two identity keys
   *  in X25519 form, initiator first. Fixed at session setup. */
  ad: string;
}

// ------------------------------------------------------------ KDFs

/** KDF_RK(rk, dhOut) -> (rk', ck). HKDF-SHA256, salt = current root key. */
function kdfRk(rk: Uint8Array, dhOut: Uint8Array): [Uint8Array, Uint8Array] {
  const out = hkdf(dhOut, rk, utf8(RATCHET_INFO), 64);
  return [out.slice(0, 32), out.slice(32, 64)];
}

/** KDF_CK(ck) -> (mk, ck'). Single-byte domain separation per the spec. */
function kdfCk(ck: Uint8Array): [Uint8Array, Uint8Array] {
  const mk = hmac(ck, new Uint8Array([0x01]));
  const next = hmac(ck, new Uint8Array([0x02]));
  return [mk, next];
}

/** Expand a message key into (encKey, authKey, iv) via HKDF-SHA256. */
function messageSecrets(mk: Uint8Array): {
  encKey: Uint8Array;
  authKey: Uint8Array;
  iv: Uint8Array;
} {
  const out = hkdf(mk, ZERO_SALT, utf8(MESSAGE_KEYS_INFO), 80);
  return {
    encKey: out.slice(0, 32),
    authKey: out.slice(32, 64),
    iv: out.slice(64, 80),
  };
}

// ------------------------------------------------------------ header / AD

/** Canonical header bytes: dh (32) || u32be(pn) || u32be(n). */
export function headerBytes(h: RatchetHeader): Uint8Array {
  return concat(unb64(h.dh), u32be(h.pn), u32be(h.n));
}

function fullAd(st: RatchetState, h: RatchetHeader): Uint8Array {
  return concat(unb64(st.ad), headerBytes(h));
}

// ------------------------------------------------------------ per-message AEAD

/** body = AES-CBC(encKey, iv, plaintext) || HMAC-SHA256(authKey, ad||ct) */
function encryptWithMk(
  mk: Uint8Array,
  plaintext: Uint8Array,
  ad: Uint8Array,
): Uint8Array {
  const { encKey, authKey, iv } = messageSecrets(mk);
  const ct = aesCbcEncrypt(encKey, iv, plaintext);
  const tag = hmac(authKey, concat(ad, ct));
  return concat(ct, tag);
}

function decryptWithMk(
  mk: Uint8Array,
  body: Uint8Array,
  ad: Uint8Array,
): Uint8Array {
  // Smallest valid body: one padded AES block (16) + full tag (32).
  if (body.length < 48) {
    throw new DecryptFailure("bad-mac", "message body too short");
  }
  const ct = body.slice(0, body.length - 32);
  const tag = body.slice(body.length - 32);
  const { encKey, authKey, iv } = messageSecrets(mk);
  const expected = hmac(authKey, concat(ad, ct));
  // Verify FIRST, decrypt second — never touch unauthenticated plaintext.
  if (!eq(expected, tag)) {
    throw new DecryptFailure("bad-mac", "message authentication failed");
  }
  try {
    return aesCbcDecrypt(encKey, iv, ct);
  } catch {
    // MAC passed but padding failed — should be unreachable; still map
    // it to bad-mac rather than leaking a library error upward.
    throw new DecryptFailure("bad-mac", "message decryption failed");
  }
}

// ------------------------------------------------------------ initialization

/**
 * Alice (initiator): the X3DH secret becomes the root key; the first
 * sending chain is derived from DH(fresh ratchet key, Bob's signed
 * prekey) — the signed prekey doubles as Bob's initial ratchet key.
 */
export function initAliceState(
  sk: Uint8Array,
  remoteSpkPub: Uint8Array,
  ad: Uint8Array,
): RatchetState {
  const dhSelf = xGenerate();
  const dhOut = xDH(dhSelf.priv, remoteSpkPub);
  if (!dhOut) {
    throw new DecryptFailure("desync", "ratchet DH with signed prekey failed");
  }
  const [rk, ckSend] = kdfRk(sk, dhOut);
  return {
    rk: b64(rk),
    dhSelfPriv: b64(dhSelf.priv),
    dhSelfPub: b64(dhSelf.pub),
    dhRemote: b64(remoteSpkPub),
    ckSend: b64(ckSend),
    ckRecv: null,
    nSend: 0,
    nRecv: 0,
    pnSend: 0,
    skipped: [],
    ad: b64(ad),
  };
}

/**
 * Bob (responder): root key is the X3DH secret itself; his signed
 * prekey pair IS his initial ratchet keypair. Both chains are null —
 * the receiving chain is created by the DH ratchet step when Alice's
 * first message arrives, the sending chain when he replies.
 */
export function initBobState(
  sk: Uint8Array,
  spkPair: KeyPair,
  ad: Uint8Array,
): RatchetState {
  return {
    rk: b64(sk),
    dhSelfPriv: b64(spkPair.priv),
    dhSelfPub: b64(spkPair.pub),
    dhRemote: null,
    ckSend: null,
    ckRecv: null,
    nSend: 0,
    nRecv: 0,
    pnSend: 0,
    skipped: [],
    ad: b64(ad),
  };
}

// ------------------------------------------------------------ skipped keys

/**
 * Advance the receiving chain up to (not including) message number
 * `until`, storing every stepped-over message key as a skipped key so
 * the messages can still be decrypted if they arrive late. Uses the
 * CURRENT dhRemote/ckRecv — callers must invoke this before a DH
 * ratchet step replaces them when flushing the previous chain.
 */
function skipMessageKeys(st: RatchetState, until: number): void {
  if (until - st.nRecv > MAX_SKIP_PER_GAP) {
    throw new DecryptFailure(
      "desync",
      `message gap ${until - st.nRecv} exceeds MAX_SKIP_PER_GAP`,
    );
  }
  if (!st.ckRecv || !st.dhRemote) return;
  while (st.nRecv < until) {
    const [mk, next] = kdfCk(unb64(st.ckRecv));
    st.ckRecv = b64(next);
    st.skipped.push({ dh: st.dhRemote, n: st.nRecv, mk: b64(mk) });
    st.nRecv++;
  }
  // Bound memory: drop the oldest skipped keys beyond the cap.
  while (st.skipped.length > MAX_SKIPPED_KEYS) st.skipped.shift();
}

// ------------------------------------------------------------ encrypt

export function ratchetEncrypt(
  st: RatchetState,
  plaintext: Uint8Array,
): { header: RatchetHeader; body: Uint8Array } {
  if (!st.ckSend) {
    throw new DecryptFailure("desync", "no sending chain (ratchet not started)");
  }
  const [mk, next] = kdfCk(unb64(st.ckSend));
  st.ckSend = b64(next);
  const header: RatchetHeader = {
    dh: st.dhSelfPub,
    pn: st.pnSend,
    n: st.nSend,
  };
  st.nSend++;
  const body = encryptWithMk(mk, plaintext, fullAd(st, header));
  return { header, body };
}

// ------------------------------------------------------------ decrypt

export function ratchetDecrypt(
  st: RatchetState,
  header: RatchetHeader,
  body: Uint8Array,
): Uint8Array {
  const ad = fullAd(st, header);

  // (1) Out-of-order message whose key we stored when we skipped past
  // it. The key is single-use: delete it as we consume it.
  const hit = st.skipped.findIndex(
    (s) => s.dh === header.dh && s.n === header.n,
  );
  if (hit >= 0) {
    const mk = unb64(st.skipped[hit].mk);
    st.skipped.splice(hit, 1);
    return decryptWithMk(mk, body, ad);
  }

  // (2) New ratchet public key from the peer -> DH ratchet step.
  if (header.dh !== st.dhRemote) {
    // First flush the remainder of the PREVIOUS receiving chain: the
    // header's PN tells us how long that chain was, so keys for any
    // messages we never saw stay decryptable as skipped keys.
    if (st.dhRemote && st.ckRecv) {
      skipMessageKeys(st, header.pn);
    }
    st.pnSend = st.nSend;
    st.nSend = 0;
    st.nRecv = 0;
    st.dhRemote = header.dh;

    // Receiving chain from our CURRENT ratchet key vs their new key...
    const dhRecv = xDH(unb64(st.dhSelfPriv), unb64(header.dh));
    if (!dhRecv) {
      throw new DecryptFailure("desync", "DH ratchet step failed (receiving)");
    }
    const [rk1, ckRecv] = kdfRk(unb64(st.rk), dhRecv);
    st.rk = b64(rk1);
    st.ckRecv = b64(ckRecv);

    // ...then generate a fresh ratchet keypair and derive the sending
    // chain from it, so our next reply heals the session forward.
    const fresh = xGenerate();
    st.dhSelfPriv = b64(fresh.priv);
    st.dhSelfPub = b64(fresh.pub);
    const dhSend = xDH(fresh.priv, unb64(header.dh));
    if (!dhSend) {
      throw new DecryptFailure("desync", "DH ratchet step failed (sending)");
    }
    const [rk2, ckSend] = kdfRk(unb64(st.rk), dhSend);
    st.rk = b64(rk2);
    st.ckSend = b64(ckSend);
  }

  // (3) Same chain (or the chain just created above): skip forward to
  // the message's number, then step once for this message's key.
  if (!st.ckRecv) {
    throw new DecryptFailure("desync", "no receiving chain for header");
  }
  if (header.n < st.nRecv) {
    // Not in the skipped store and already passed — a duplicate or a
    // replay of a long-consumed message.
    throw new DecryptFailure("desync", "message number already consumed");
  }
  skipMessageKeys(st, header.n);
  const [mk, next] = kdfCk(unb64(st.ckRecv));
  st.ckRecv = b64(next);
  const plaintext = decryptWithMk(mk, body, ad);
  st.nRecv++;
  return plaintext;
}

// ------------------------------------------------------------ serialization

export function serializeState(st: RatchetState): string {
  return JSON.stringify(st);
}

export function deserializeState(s: string): RatchetState {
  let raw: unknown;
  try {
    raw = JSON.parse(s);
  } catch {
    throw new DecryptFailure("desync", "corrupt session state (bad JSON)");
  }
  const o = raw as Record<string, unknown> | null;
  const bad = (): never => {
    throw new DecryptFailure("desync", "corrupt session state (bad shape)");
  };
  if (!o || typeof o !== "object") bad();
  if (typeof o!.rk !== "string") bad();
  if (typeof o!.dhSelfPriv !== "string") bad();
  if (typeof o!.dhSelfPub !== "string") bad();
  if (o!.dhRemote !== null && typeof o!.dhRemote !== "string") bad();
  if (o!.ckSend !== null && typeof o!.ckSend !== "string") bad();
  if (o!.ckRecv !== null && typeof o!.ckRecv !== "string") bad();
  if (typeof o!.ad !== "string") bad();
  for (const k of ["nSend", "nRecv", "pnSend"] as const) {
    if (typeof o![k] !== "number" || !Number.isInteger(o![k]) || (o![k] as number) < 0) bad();
  }
  if (!Array.isArray(o!.skipped)) bad();
  for (const sk of o!.skipped as unknown[]) {
    const e = sk as Record<string, unknown> | null;
    if (
      !e ||
      typeof e.dh !== "string" ||
      typeof e.mk !== "string" ||
      typeof e.n !== "number" ||
      !Number.isInteger(e.n) ||
      e.n < 0
    ) {
      bad();
    }
  }
  return raw as RatchetState;
}
