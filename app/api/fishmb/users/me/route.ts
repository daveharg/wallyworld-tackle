// PATCH /api/fishmb/users/me — update your own profile privacy.
// Body: { hidden_stats: string[] } — stat keys hidden from other people.
// DELETE /api/fishmb/users/me — permanently delete your own account.
//   Removes the fm_users row; nearly every fm_* table references it
//   ON DELETE CASCADE, so the angler's posts, comments, catches, stories,
//   spots, friendships and sessions go with it (as the privacy policy
//   promises: profile removed, posts out of public view). The two
//   tournament columns that reference users without a cascade are
//   nulled first so their tournament records stay valid.

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

export async function DELETE(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  // Null the only two fm_users references that have no ON DELETE action,
  // so the cascades below can run (tournament history itself is kept).
  // Best-effort: on a database where those tables/columns were never
  // created there is nothing to null.
  try {
    await query(`UPDATE fm_tournament_entries SET reviewed_by = NULL WHERE reviewed_by = $1`, [me.id]);
  } catch { /* table not created yet */ }
  try {
    await query(`UPDATE fm_tournament_participants SET paid_marked_by = NULL WHERE paid_marked_by = $1`, [me.id]);
  } catch { /* table/column not created yet */ }
  await query(`DELETE FROM fm_sessions WHERE user_id = $1`, [me.id]);
  await query(`DELETE FROM fm_users WHERE id = $1`, [me.id]);
  return NextResponse.json({ ok: true, deleted: true });
}
