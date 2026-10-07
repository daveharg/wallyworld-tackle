// POST /api/fish/contests/[id]/settle — declare winner(s), pay the pot.
// Creator only. Allowed once ends_at has passed (or earlier at the creator's
// discretion). PLAY MONEY ONLY: winner-takes-pot; ties split evenly with any
// remainder chips to the earliest joiner; if nobody logged a catch, stakes
// are refunded.

import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/fish/db";
import { fishUserFromRequest, unauthorized, notFound, forbidden, badRequest } from "@/lib/fish/auth";
import { settleContest, type Contest } from "@/lib/fish/scoring";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;

  const contest = await queryOne<Contest>(`SELECT * FROM fm_contests WHERE id = $1`, [id]);
  if (!contest) return notFound("Contest not found.");
  if (contest.creator_id !== me.id) return forbidden("Only the creator can settle this contest.");
  if (contest.status !== "open") return badRequest("This contest is already settled.");

  try {
    const result = await settleContest(id, me.id);
    return NextResponse.json({ ok: true, contest_id: id, ...result });
  } catch (err) {
    const e = err as Error & { status?: number };
    const status = e.status ?? 500;
    return NextResponse.json({ error: status === 500 ? "Could not settle contest." : e.message }, { status });
  }
}
