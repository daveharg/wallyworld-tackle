// PATCH /api/fishmb/users/me — update your own profile privacy.
// Body: { hidden_stats: string[] } — stat keys hidden from other people.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, unauthorized, badRequest, ensureProfileColumns } from "@/lib/fish/auth";
import { query } from "@/lib/fish/db";
import { STAT_KEYS } from "@/lib/fish/stats";

export async function PATCH(req: NextRequest) {
  await ensureProfileColumns();
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  if (!Array.isArray(body.hidden_stats)) return badRequest("hidden_stats must be an array.");
  const hidden = (body.hidden_stats as unknown[])
    .filter((k): k is string => typeof k === "string")
    .filter((k) => (STAT_KEYS as readonly string[]).includes(k));
  await query(`UPDATE fm_users SET hidden_stats = $1 WHERE id = $2`, [hidden, me.id]);
  return NextResponse.json({ hidden_stats: hidden });
}
