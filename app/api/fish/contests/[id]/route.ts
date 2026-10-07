// GET /api/fish/contests/[id] — contest detail (visibility-gated).
// Includes entrants, pot, status, winner, and whether you have joined.

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  forbidden,
  notFound,
  publicUser,
  type FishUser,
} from "@/lib/fish/auth";
import { canViewContest, type Contest } from "@/lib/fish/scoring";

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

  const creator = await queryOne<FishUser>(`SELECT * FROM fm_users WHERE id = $1`, [contest.creator_id]);
  const entrants = await query<{ user_id: string; name: string; avatar_url: string | null; joined_at: string; stake_paid: number }>(
    `SELECT e.user_id, u.name, u.avatar_url, e.joined_at, e.stake_paid
       FROM fm_contest_entries e
       JOIN fm_users u ON u.id = e.user_id
      WHERE e.contest_id = $1
      ORDER BY e.joined_at ASC`,
    [id]
  );
  const pot = entrants.reduce((n, e) => n + e.stake_paid, 0);
  const joined = me ? entrants.some((e) => e.user_id === me.id) : false;
  const winner = contest.winner_user_id
    ? entrants.find((e) => e.user_id === contest.winner_user_id) ?? null
    : null;

  return NextResponse.json({
    contest: {
      id: contest.id,
      title: contest.title,
      type: contest.type,
      species: contest.species,
      size_threshold_in: contest.size_threshold_in === null ? null : Number(contest.size_threshold_in),
      daily_limit: contest.daily_limit,
      period: contest.period,
      starts_at: contest.starts_at,
      ends_at: contest.ends_at,
      visibility: contest.visibility,
      stake: contest.stake,
      status: contest.status,
      pot,
      entrants: entrants.length,
      creator: creator ? publicUser(creator) : null,
      is_creator: me?.id === contest.creator_id,
      joined,
      // Invite code: shown to creator and to joined members only.
      invite_code:
        me && (me.id === contest.creator_id || joined) ? contest.invite_code : undefined,
      winner: winner
        ? { id: winner.user_id, name: winner.name, avatar_url: winner.avatar_url }
        : null,
      entrant_list: entrants.map((e) => ({
        id: e.user_id,
        name: e.name,
        avatar_url: e.avatar_url,
        joined_at: e.joined_at,
      })),
    },
  });
}
