// POST /api/fish/contests/[id]/join — join a contest (auth required).
// Body: { invite_code? } (required when visibility = 'invite').
// If the contest has a stake, the play-money entry fee is deducted from your
// balance (with a ledger row) inside the same transaction as the join.

import { NextRequest, NextResponse } from "next/server";
import { queryOne, withTransaction, txQueryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  forbidden,
  notFound,
  adjustBalance,
} from "@/lib/fish/auth";
import type { Contest } from "@/lib/fish/scoring";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const { id } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* invite_code is optional; empty body is fine */
  }

  const result = await withTransaction(async (client) => {
    const contest = await txQueryOne<Contest>(
      client,
      `SELECT * FROM fm_contests WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!contest) throw Object.assign(new Error("Contest not found."), { status: 404 });
    if (contest.status !== "open") {
      throw Object.assign(new Error("This contest is no longer open."), { status: 400 });
    }
    if (contest.visibility === "invite" && me.id !== contest.creator_id) {
      const code = typeof body.invite_code === "string" ? body.invite_code.trim().toUpperCase() : "";
      if (!code || code !== contest.invite_code) {
        throw Object.assign(new Error("A valid invite code is required."), { status: 403 });
      }
    }
    const existing = await txQueryOne(
      client,
      `SELECT 1 FROM fm_contest_entries WHERE contest_id = $1 AND user_id = $2`,
      [id, me.id]
    );
    if (existing) throw Object.assign(new Error("You've already joined."), { status: 400 });

    let newBalance = me.play_balance;
    if (contest.stake > 0) {
      const bal = await txQueryOne<{ play_balance: number }>(
        client,
        `SELECT play_balance FROM fm_users WHERE id = $1 FOR UPDATE`,
        [me.id]
      );
      if (!bal || bal.play_balance < contest.stake) {
        throw Object.assign(
          new Error(`Not enough chips. Entry costs ${contest.stake} play-money chips; you have ${bal?.play_balance ?? 0}.`),
          { status: 400 }
        );
      }
      newBalance = await adjustBalance(client, me.id, -contest.stake, "contest_entry", id);
    }
    await txQueryOne(
      client,
      `INSERT INTO fm_contest_entries (contest_id, user_id, stake_paid)
       VALUES ($1, $2, $3)`,
      [id, me.id, contest.stake]
    );
    return { stake_paid: contest.stake, play_balance: newBalance };
  }).catch((err: unknown) => {
    const e = err as Error & { status?: number };
    return { routeError: e.message, status: e.status ?? 500 } as const;
  });

  if ("routeError" in result) {
    if (result.status === 404) return notFound(result.routeError);
    if (result.status === 403) return forbidden(result.routeError);
    if (result.status === 400) return badRequest(result.routeError);
    return NextResponse.json({ error: "Could not join contest." }, { status: 500 });
  }
  return NextResponse.json(
    { ok: true, stake_paid: result.stake_paid, play_balance: result.play_balance },
    { status: 201 }
  );
}
