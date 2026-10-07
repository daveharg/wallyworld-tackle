// GET /api/fish/contests/[id]/leaderboard — ranked standings (visibility-gated).
// Scores derive from entrants' catches inside the contest window. Only
// aggregate numbers are exposed — never private catch details.

import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/fish/db";
import { fishUserFromRequest, forbidden, notFound } from "@/lib/fish/auth";
import { canViewContest, computeLeaderboard, type Contest } from "@/lib/fish/scoring";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await fishUserFromRequest(req);
  const url = new URL(req.url);
  const inviteCode = url.searchParams.get("invite_code");

  const contest = await queryOne<Contest>(`SELECT * FROM fm_contests WHERE id = $1`, [id]);
  if (!contest) return notFound("Contest not found.");
  if (!(await canViewContest(contest, me, inviteCode))) {
    return forbidden("You can't view this contest.");
  }

  const board = await computeLeaderboard(contest);
  return NextResponse.json({ leaderboard: board });
}
