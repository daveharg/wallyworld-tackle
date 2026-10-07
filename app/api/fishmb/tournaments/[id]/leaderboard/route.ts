// GET /api/fishmb/tournaments/[id]/leaderboard — public leaderboard snapshot
// for the full-screen display board (auto-refreshes client-side).

import { NextResponse } from "next/server";
import { getTournament, getLeaderboard } from "@/lib/fish/tournaments";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const t = await getTournament(params.id);
  if (!t) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }
  const board = await getLeaderboard(t.id, t.scoring);
  return NextResponse.json({
    tournament: {
      id: t.id,
      name: t.name,
      status: t.status,
      scoring: t.scoring,
      starts_at: t.starts_at,
      ends_at: t.ends_at,
    },
    leaderboard: board,
  });
}
