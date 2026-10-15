// Fish Manitoba backend — Apple identity token verification.
//
// Mirrors lib/fish/google.ts: verifies the RS256 signature against Apple's
// published JWKS (cached 1h), then checks issuer, audience and expiry.
// No new dependencies: uses node:crypto with JWK import. The raw
// identity token is never logged.

import { createPublicKey, createVerify, type JsonWebKey } from "crypto";

const KEYS_URL = "https://appleid.apple.com/auth/keys";
const ISSUER = "https://appleid.apple.com";
// The audience of a native Sign in with Apple identity token is the app's
// bundle ID (the Sign in with Apple capability is tied to the App ID).
const AUDIENCE = "ca.fishmb.app";

interface JwkSet {
  keys: Array<{
    kid: string;
    kty: string;
    n: string;
    e: string;
    use?: string;
    alg?: string;
  }>;
}

export interface AppleProfile {
  /** Apple's stable subject id for this user — the account identity key. */
  sub: string;
  /** Present in the token only on the user's first consent. May be a
   *  Hide My Email relay address (@privaterelay.appleid.com). */
  email: string | null;
}

let keyCache: { fetchedAt: number; keys: JwkSet["keys"] } | null = null;

async function getAppleKeys(): Promise<JwkSet["keys"]> {
  if (keyCache && Date.now() - keyCache.fetchedAt < 3_600_000) {
    return keyCache.keys;
  }
  const res = await fetch(KEYS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error("Could not fetch Apple signing keys.");
  const set = (await res.json()) as JwkSet;
  keyCache = { fetchedAt: Date.now(), keys: set.keys };
  return set.keys;
}

function b64urlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export async function verifyAppleIdToken(
  idToken: string
): Promise<AppleProfile> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Apple identity token.");
  const [hB64, pB64, sigB64] = parts;
  let header: { kid?: string; alg?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64urlToBuffer(hB64).toString("utf8"));
    payload = JSON.parse(b64urlToBuffer(pB64).toString("utf8"));
  } catch {
    throw new Error("Invalid Apple identity token.");
  }
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Invalid Apple identity token.");
  }
  const keys = await getAppleKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown Apple signing key.");

  const key = createPublicKey({ key: jwk as unknown as JsonWebKey, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${hB64}.${pB64}`);
  verifier.end();
  if (!verifier.verify(key, b64urlToBuffer(sigB64))) {
    throw new Error("Invalid Apple identity token signature.");
  }

  const now = Math.floor(Date.now() / 1000);
  const iss = payload.iss as string | undefined;
  const aud = payload.aud as string | undefined;
  const exp = payload.exp as number | undefined;
  const sub = payload.sub as string | undefined;
  if (iss !== ISSUER) throw new Error("Invalid token issuer.");
  if (aud !== AUDIENCE) throw new Error("Token audience mismatch.");
  if (typeof exp !== "number" || exp <= now) throw new Error("Token expired.");
  if (!sub) throw new Error("Token has no subject.");

  return {
    sub,
    email: (payload.email as string | undefined) ?? null,
  };
}
