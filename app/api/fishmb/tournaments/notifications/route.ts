// GET /api/fishmb/tournaments/notifications — organizer alerts (auth required).
// Returns the number of new tournament joins the user hasn't seen yet:
// participants who joined the user's organized tournaments after the
// organizer last opened the manage page (participants_seen_at).

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  ensureProfileColumns,
} from "@/lib/fish/auth";
import { ensureTournamentTables } from "@/lib/fish/tournaments";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  await ensureProfileColumns();
  await ensureTournamentTables();

  const rows = await query<{ new_joins: string }>(
    `SELECT COUNT(*) AS new_joins
       FROM fm_tournament_participants p
       JOIN fm_tournaments t ON t.id = p.tournament_id
      WHERE t.organizer_id = $1
        AND p.user_id != $1
        AND (t.participants_seen_at IS NULL OR p.joined_at > t.participants_seen_at)`,
    [me.id]
  );
  // Detailed list: who joined which tournament, when, and which key they used.
  const details = await query<{
    tournament_id: string;
    tournament_name: string;
    user_id: string;
    user_name: string | null;
    joined_at: string;
    key_code: string | null;
    key_label: string | null;
  }>(
    `SELECT t.id AS tournament_id, t.name AS tournament_name,
            p.user_id, u.name AS user_name, p.joined_at,
            k.key_code, k.label AS key_label
       FROM fm_tournament_participants p
       JOIN fm_tournaments t ON t.id = p.tournament_id
       LEFT JOIN fm_users u ON u.id = p.user_id
       LEFT JOIN fm_tournament_keys k ON k.used_by_user_id = p.user_id AND k.tournament_id = t.id
      WHERE t.organizer_id = $1
        AND p.user_id != $1
        AND (t.participants_seen_at IS NULL OR p.joined_at > t.participants_seen_at)
      ORDER BY p.joined_at DESC`,
    [me.id]
  );
  // Which tournaments have unseen joins (for deep-linking the notification).
  const tourneys = await query<{ id: string; name: string; new_joins: string }>(
    `SELECT t.id, t.name, COUNT(*) AS new_joins
       FROM fm_tournament_participants p
       JOIN fm_tournaments t ON t.id = p.tournament_id
      WHERE t.organizer_id = $1
        AND p.user_id != $1
        AND (t.participants_seen_at IS NULL OR p.joined_at > t.participants_seen_at)
      GROUP BY t.id, t.name
      ORDER BY MAX(p.joined_at) DESC`,
    [me.id]
  );
  return NextResponse.json({
    new_joins: Number(rows[0]?.new_joins ?? 0),
    tournaments: tourneys.map((t) => ({
      id: t.id,
      name: t.name,
      new_joins: Number(t.new_joins),
    })),
    details: details.map((d) => ({
      tournament_id: d.tournament_id,
      tournament_name: d.tournament_name,
      user_name: d.user_name || "An angler",
      joined_at: d.joined_at,
      key_code: d.key_code,
      key_label: d.key_label,
    })),
  });
}

/** POST — mark tournaments as seen. Body: { tournament_id } for one, or empty for all. */
export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  await ensureTournamentTables();
  let tournamentId: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.tournament_id === "string") tournamentId = body.tournament_id;
  } catch {
    // No body — mark all.
  }
  if (tournamentId) {
    await query(
      `UPDATE fm_tournaments SET participants_seen_at = now() WHERE id = $1 AND organizer_id = $2`,
      [tournamentId, me.id]
    );
  } else {
    await query(
      `UPDATE fm_tournaments SET participants_seen_at = now() WHERE organizer_id = $1`,
      [me.id]
    );
  }
  return NextResponse.json({ ok: true });
}
