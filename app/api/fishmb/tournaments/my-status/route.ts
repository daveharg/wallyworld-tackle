// GET /api/fishmb/tournaments/my-status — which tournaments the current user
// is registered in or organizes (auth required).
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized } from "@/lib/fish/auth";
import { ensureTournamentTables } from "@/lib/fish/tournaments";

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  await ensureTournamentTables();

  const rows = await query<{ tournament_id: string; role: string }>(
    `SELECT t.id AS tournament_id,
            CASE WHEN t.organizer_id = $1 THEN 'organizer' ELSE 'participant' END AS role
       FROM fm_tournaments t
       LEFT JOIN fm_tournament_participants p ON p.tournament_id = t.id AND p.user_id = $1
      WHERE t.organizer_id = $1 OR p.user_id IS NOT NULL`,
    [me.id]
  );
  return NextResponse.json({
    statuses: rows.map((r) => ({ tournament_id: r.tournament_id, role: r.role })),
  });
}
