// Fish Manitoba backend — Google ID token verification.
//
// Verifies the RS256 signature against Google's published certs (cached 1h),
// then checks issuer, audience and expiry. No new dependencies: uses
// node:crypto with JWK import. The raw id_token is never logged.

import { createPublicKey, createVerify, type JsonWebKey } from "crypto";

const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

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

export interface GoogleProfile {
  sub: string;
  email: string | null;
  name: string;
  picture: string | null;
}

let certCache: { fetchedAt: number; keys: JwkSet["keys"] } | null = null;

async function getGoogleKeys(): Promise<JwkSet["keys"]> {
  if (certCache && Date.now() - certCache.fetchedAt < 3_600_000) {
    return certCache.keys;
  }
  const res = await fetch(CERTS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error("Could not fetch Google certificates.");
  const set = (await res.json()) as JwkSet;
  certCache = { fetchedAt: Date.now(), keys: set.keys };
  return set.keys;
}

function b64urlToBuffer(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/** Audiences we trust: the web client ID plus the iOS client ID if set. */
function allowedAudiences(): string[] {
  const ids = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_IOS_CLIENT_ID];
  return ids.filter((v): v is string => !!v);
}

export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleProfile> {
  const auds = allowedAudiences();
  if (auds.length === 0) {
    throw new Error(
      "Google sign-in is not configured (set GOOGLE_CLIENT_ID)."
    );
  }
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Google ID token.");
  const [hB64, pB64, sigB64] = parts;
  let header: { kid?: string; alg?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64urlToBuffer(hB64).toString("utf8"));
    payload = JSON.parse(b64urlToBuffer(pB64).toString("utf8"));
  } catch {
    throw new Error("Invalid Google ID token.");
  }
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Invalid Google ID token.");
  }
  const keys = await getGoogleKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("Unknown Google signing key.");

  const key = createPublicKey({ key: jwk as unknown as JsonWebKey, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${hB64}.${pB64}`);
  verifier.end();
  if (!verifier.verify(key, b64urlToBuffer(sigB64))) {
    throw new Error("Invalid Google ID token signature.");
  }

  const now = Math.floor(Date.now() / 1000);
  const iss = payload.iss as string | undefined;
  const aud = payload.aud as string | undefined;
  const exp = payload.exp as number | undefined;
  const sub = payload.sub as string | undefined;
  if (!iss || !ISSUERS.includes(iss)) throw new Error("Invalid token issuer.");
  if (!aud || !auds.includes(aud)) throw new Error("Token audience mismatch.");
  if (typeof exp !== "number" || exp <= now) throw new Error("Token expired.");
  if (!sub) throw new Error("Token has no subject.");

  return {
    sub,
    email: (payload.email as string | undefined) ?? null,
    name:
      (payload.name as string | undefined) ??
      (payload.email as string | undefined) ??
      "Angler",
    picture: (payload.picture as string | undefined) ?? null,
  };
}
