// /api/fishmb/my-catches — the signed-in user's catches, regular + tournament.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  // Regular catches.
  const regular = await query<{
    id: string;
    species: string;
    length_in: string | null;
    photo_hold_url: string | null;
    photo_measure_url: string | null;
    caught_at: string;
    visibility: string;
    personal_record: boolean;
  }>(
    `SELECT id, species, length_in, photo_hold_url, photo_measure_url, caught_at,
            visibility, COALESCE(personal_record, false) AS personal_record
     FROM fm_catches WHERE user_id = $1 ORDER BY caught_at DESC LIMIT 100`,
    [me.id]
  );

  // Tournament entries (approved only).
  const tourney = await query<{
    id: string;
    species: string;
    length_in: string | null;
    photo_hold_url: string | null;
    photo_measure_url: string | null;
    caught_at: string;
    tournament_id: string;
    tournament_name: string;
  }>(
    `SELECT e.id, e.species, e.length_inches AS length_in, e.photo_url AS photo_hold_url,
            NULL AS photo_measure_url, e.caught_at, e.tournament_id, t.name AS tournament_name
     FROM fm_tournament_entries e
     JOIN fm_tournaments t ON t.id = e.tournament_id
     WHERE e.user_id = $1 AND e.status = 'approved'
     ORDER BY e.caught_at DESC LIMIT 100`,
    [me.id]
  );

  const catches = [
    ...regular.map((c) => ({ ...c, tournament_id: null, tournament_name: null })),
    ...tourney,
  ].sort((a, b) => new Date(b.caught_at).getTime() - new Date(a.caught_at).getTime());

  return NextResponse.json({ catches });
}
