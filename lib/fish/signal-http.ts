// Shared request-shape validation for the /api/fishmb/sig/* routes.
// (Kept out of the route files: Next only allows specific exports there.)

import {
  isB64Key,
  isB64Signature,
  type SigSignedPrekeyInput,
  type SigOneTimePrekeyInput,
} from "./signal";

export const UUIDISH =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const MAX_DEVICE_ID = 2 ** 31 - 1;

export function isValidDeviceId(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_DEVICE_ID;
}

export function isValidKeyId(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_DEVICE_ID;
}

/** Parse a ?device_id= query param; null when absent or out of shape. */
export function parseDeviceIdParam(raw: string | null): number | null {
  if (raw === null || !/^[0-9]+$/.test(raw)) return null;
  const n = Number(raw);
  return isValidDeviceId(n) ? n : null;
}

export function parseSignedPrekey(raw: unknown): SigSignedPrekeyInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const key = typeof r.key === "string" ? r.key.trim() : "";
  const signature = typeof r.signature === "string" ? r.signature.trim() : "";
  if (!isValidKeyId(r.key_id)) return null;
  if (!isB64Key(key)) return null;
  if (!isB64Signature(signature)) return null;
  return { key_id: r.key_id, key, signature };
}

/** A batch of one-time prekeys: 1..200 entries, each a valid key. */
export function parseOneTimePrekeys(raw: unknown): SigOneTimePrekeyInput[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 200) return null;
  const out: SigOneTimePrekeyInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const key = typeof r.key === "string" ? r.key.trim() : "";
    if (!isValidKeyId(r.key_id)) return null;
    if (!isB64Key(key)) return null;
    out.push({ key_id: r.key_id, key });
  }
  return out;
}
