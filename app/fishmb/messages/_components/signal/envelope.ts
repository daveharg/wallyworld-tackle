// SigEnvelope wire codec. Envelopes travel as a JSON string in
// fm_messages.ciphertext (with proto/nonce pinned to "sig1" in their
// own columns), so encoding is just JSON.stringify — the important half
// is DECODE: every envelope arrives from the server (relayed from
// another device, potentially a hostile or buggy one), so the shape is
// fully validated before any cryptography touches it. Anything off
// throws DecryptFailure("bad-envelope").

import { unb64 } from "./bytes";
import { DecryptFailure, type SigEnvelope } from "./types";

function fail(msg: string): never {
  throw new DecryptFailure("bad-envelope", msg);
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

/** String that base64-decodes to exactly `len` bytes (or any length when
 *  len is null). Returns the decoded bytes. */
function b64Field(v: unknown, len: number | null, name: string): Uint8Array {
  if (typeof v !== "string" || v.length === 0) {
    fail(`envelope field ${name} missing or not a string`);
  }
  let bytes: Uint8Array;
  try {
    bytes = unb64(v as string);
  } catch {
    fail(`envelope field ${name} is not valid base64`);
  }
  if (len !== null && bytes!.length !== len) {
    fail(`envelope field ${name} has wrong length`);
  }
  return bytes!;
}

export function encodeEnvelope(env: SigEnvelope): string {
  return JSON.stringify(env);
}

export function decodeEnvelope(s: string): SigEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(s);
  } catch {
    fail("envelope is not valid JSON");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    fail("envelope is not an object");
  }
  const o = raw as Record<string, unknown>;

  if (o.v !== 1) fail("unsupported envelope version");
  if (o.t !== "pk" && o.t !== "msg") fail("unknown envelope type");
  if (!isNonNegInt(o.fd)) fail("envelope fd must be an integer >= 0");

  // Header: dh is a 32-byte X25519 public key; pn/n are chain counters.
  if (!o.h || typeof o.h !== "object" || Array.isArray(o.h)) {
    fail("envelope header missing");
  }
  const h = o.h as Record<string, unknown>;
  b64Field(h.dh, 32, "h.dh");
  if (!isNonNegInt(h.pn)) fail("header pn must be an integer >= 0");
  if (!isNonNegInt(h.n)) fail("header n must be an integer >= 0");

  // Body: ciphertext || 32-byte MAC tag, so >= 48 bytes decoded, and it
  // must at least be a non-empty base64 string.
  if (typeof o.b !== "string" || o.b.length === 0) {
    fail("envelope body missing");
  }
  b64Field(o.b, null, "b");

  const header = { dh: h.dh as string, pn: h.pn as number, n: h.n as number };

  if (o.t === "pk") {
    // PreKeyMessage additionally carries everything the responder
    // needs to run X3DH: sender identity, ephemeral key, prekey ids.
    b64Field(o.ik, 32, "ik");
    b64Field(o.ek, 32, "ek");
    if (!isNonNegInt(o.spk)) fail("pk envelope spk must be an integer >= 0");
    if (o.opk !== null && !isNonNegInt(o.opk)) {
      fail("pk envelope opk must be null or an integer >= 0");
    }
    return {
      v: 1,
      t: "pk",
      fd: o.fd as number,
      ik: o.ik as string,
      ek: o.ek as string,
      spk: o.spk as number,
      opk: o.opk as number | null,
      h: header,
      b: o.b as string,
    };
  }

  return {
    v: 1,
    t: "msg",
    fd: o.fd as number,
    h: header,
    b: o.b as string,
  };
}
