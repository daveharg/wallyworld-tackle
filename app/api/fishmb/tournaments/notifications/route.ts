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
  });
}

/** POST — mark all of the organizer's tournaments as seen (clears the badge). */
export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  await ensureTournamentTables();
  await query(
    `UPDATE fm_tournaments SET participants_seen_at = now() WHERE organizer_id = $1`,
    [me.id]
  );
  return NextResponse.json({ ok: true });
}
