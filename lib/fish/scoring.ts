// Fish Manitoba backend — contest scoring and play-money settlement.
//
// Scoring derives from fm_catches inside the contest window (caught_at BETWEEN
// starts_at AND ends_at). An entrant's catches count toward their own score
// regardless of catch visibility; leaderboards expose only aggregate numbers,
// never private catch details.
//
// Settlement (winner-takes-pot, PLAY MONEY only — never real cash):
// - Highest score wins. Ties split the pot evenly (integer division);
//   any remainder chips go to the tied winner who joined earliest.
// - If no entrant logged any catch, all stakes are refunded.
// - Everything runs in one DB transaction.

import type { PoolClient } from "pg";
import { query, queryOne, txQuery, txQueryOne, withTransaction } from "./db";
import { adjustBalance, areFriends, type PublicUser } from "./auth";

export type ContestType =
  | "most_fish"
  | "biggest_fish"
  | "most_over_size"
  | "most_over_size_daily_limit";

export interface Contest {
  id: string;
  creator_id: string;
  title: string;
  type: ContestType;
  species: string | null;
  size_threshold_in: string | null; // numeric comes back as string from pg
  daily_limit: number | null;
  period: string;
  starts_at: string;
  ends_at: string;
  visibility: "public" | "friends" | "invite";
  invite_code: string | null;
  stake: number;
  status: "open" | "settled" | "cancelled";
  winner_user_id: string | null;
  created_at: string;
}

export interface LeaderboardRow {
  user: PublicUser;
  score: number; // count, or inches for biggest_fish
  score_label: string;
  joined_at: string;
  rank: number;
}

export interface Leaderboard {
  contest_id: string;
  type: ContestType;
  status: Contest["status"];
  pot: number;
  entrants: number;
  winner: (PublicUser & { score: number }) | null;
  rows: LeaderboardRow[];
}

function scoreLabel(type: ContestType, score: number): string {
  if (type === "biggest_fish") return `${Number(score).toFixed(1)} in`;
  return `${score} fish`;
}

/** Compute the leaderboard for a contest (read-only). */
export async function computeLeaderboard(
  contest: Contest
): Promise<Leaderboard> {
  const entries = await query<{
    user_id: string;
    name: string;
    avatar_url: string | null;
    joined_at: string;
  }>(
    `SELECT e.user_id, u.name, u.avatar_url, e.joined_at
       FROM fm_contest_entries e
       JOIN fm_users u ON u.id = e.user_id
      WHERE e.contest_id = $1
      ORDER BY e.joined_at ASC`,
    [contest.id]
  );
  const potRow = await queryOne<{ pot: string }>(
    `SELECT COALESCE(SUM(stake_paid), 0) AS pot FROM fm_contest_entries WHERE contest_id = $1`,
    [contest.id]
  );

  const speciesFilter = contest.species ? `AND LOWER(c.species) = LOWER($4)` : "";
  const rows: LeaderboardRow[] = [];
  for (const e of entries) {
    const s = await queryOne<{ score: string | null }>(
      scoreQueryForUser(contest, speciesFilter),
      contest.species
        ? [e.user_id, contest.starts_at, contest.ends_at, contest.species]
        : [e.user_id, contest.starts_at, contest.ends_at]
    );
    const score = Number(s?.score ?? 0);
    rows.push({
      user: { id: e.user_id, name: e.name, avatar_url: e.avatar_url },
      score,
      score_label: scoreLabel(contest.type, score),
      joined_at: e.joined_at,
      rank: 0, // assigned after sorting below
    });
  }
  rows.sort((a, b) => b.score - a.score || +new Date(a.joined_at) - +new Date(b.joined_at));
  rows.forEach((r, i) => (r.rank = i + 1));

  let winner: Leaderboard["winner"] = null;
  if (contest.winner_user_id) {
    const w = rows.find((r) => r.user.id === contest.winner_user_id);
    if (w) winner = { ...w.user, score: w.score };
  }

  return {
    contest_id: contest.id,
    type: contest.type,
    status: contest.status,
    pot: Number(potRow?.pot ?? 0),
    entrants: entries.length,
    winner,
    rows,
  };
}

export interface SettleResult {
  winner_ids: string[];
  pot: number;
  payouts: Array<{ user_id: string; amount: number }>;
  refunded: boolean;
}

/**
 * Settle a contest: declare winner(s) and move play-money.
 * Creator-only; runs in a single transaction with the contest row locked.
 */
export async function settleContest(
  contestId: string,
  actorId: string
): Promise<SettleResult> {
  return withTransaction(async (client: PoolClient) => {
    const contest = await txQueryOne<Contest>(
      client,
      `SELECT * FROM fm_contests WHERE id = $1 FOR UPDATE`,
      [contestId]
    );
    if (!contest) throw Object.assign(new Error("Contest not found."), { status: 404 });
    if (contest.creator_id !== actorId) {
      throw Object.assign(new Error("Only the contest creator can settle."), { status: 403 });
    }
    if (contest.status !== "open") {
      throw Object.assign(new Error("Contest is already settled."), { status: 400 });
    }

    const board = await computeLeaderboardTx(client, contest);
    const pot = board.pot;
    const scored = board.rows.filter((r) => r.score > 0);

    if (scored.length === 0) {
      // Nobody logged a catch: refund every stake.
      const entries = await txQuery<{ user_id: string; stake_paid: number }>(
        client,
        `SELECT user_id, stake_paid FROM fm_contest_entries WHERE contest_id = $1`,
        [contestId]
      );
      for (const e of entries) {
        if (e.stake_paid > 0) {
          await adjustBalance(client, e.user_id, e.stake_paid, "contest_entry", contestId);
        }
      }
      await txQuery(client, `UPDATE fm_contests SET status = 'settled' WHERE id = $1`, [contestId]);
      return { winner_ids: [], pot, payouts: [], refunded: true };
    }

    const topScore = scored[0].score;
    // Tied winners, earliest joiner first (rows already sorted score desc, joined asc).
    const winners = scored.filter((r) => r.score === topScore);
    const payouts: SettleResult["payouts"] = [];
    if (pot > 0) {
      const share = Math.floor(pot / winners.length);
      const remainder = pot - share * winners.length;
      winners.forEach((w, i) => {
        const amount = share + (i === 0 ? remainder : 0);
        if (amount > 0) payouts.push({ user_id: w.user.id, amount });
      });
      for (const p of payouts) {
        await adjustBalance(client, p.user_id, p.amount, "contest_win", contestId);
      }
    }
    const winnerIds = winners.map((w) => w.user.id);
    await txQuery(
      client,
      `UPDATE fm_contests SET status = 'settled', winner_user_id = $2 WHERE id = $1`,
      [contestId, winnerIds[0]]
    );
    return { winner_ids: winnerIds, pot, payouts, refunded: false };
  });
}

/** Transaction-scoped leaderboard (used inside settle). */
async function computeLeaderboardTx(
  client: PoolClient,
  contest: Contest
): Promise<Leaderboard> {
  const entries = await txQuery<{
    user_id: string;
    name: string;
    avatar_url: string | null;
    joined_at: string;
  }>(
    client,
    `SELECT e.user_id, u.name, u.avatar_url, e.joined_at
       FROM fm_contest_entries e
       JOIN fm_users u ON u.id = e.user_id
      WHERE e.contest_id = $1
      ORDER BY e.joined_at ASC`,
    [contest.id]
  );
  const potRow = await txQueryOne<{ pot: string }>(
    client,
    `SELECT COALESCE(SUM(stake_paid), 0) AS pot FROM fm_contest_entries WHERE contest_id = $1`,
    [contest.id]
  );
  const speciesFilter = contest.species ? `AND LOWER(c.species) = LOWER($4)` : "";
  const rows: LeaderboardRow[] = [];
  for (const e of entries) {
    const s = await txQueryOne<{ score: string | null }>(
      client,
      scoreQueryForUser(contest, speciesFilter),
      contest.species
        ? [e.user_id, contest.starts_at, contest.ends_at, contest.species]
        : [e.user_id, contest.starts_at, contest.ends_at]
    );
    const score = Number(s?.score ?? 0);
    rows.push({
      user: { id: e.user_id, name: e.name, avatar_url: e.avatar_url },
      score,
      score_label: scoreLabel(contest.type, score),
      joined_at: e.joined_at,
      rank: 0,
    });
  }
  rows.sort((a, b) => b.score - a.score || +new Date(a.joined_at) - +new Date(b.joined_at));
  rows.forEach((r, i) => (r.rank = i + 1));
  return {
    contest_id: contest.id,
    type: contest.type,
    status: contest.status,
    pot: Number(potRow?.pot ?? 0),
    entrants: entries.length,
    winner: null,
    rows,
  };
}

function scoreQueryForUser(contest: Contest, speciesFilter: string): string {
  const t = Number(contest.size_threshold_in);
  const where = `c.user_id = $1
      AND c.caught_at >= $2::timestamptz
      AND c.caught_at <= $3::timestamptz
      ${speciesFilter}`;
  switch (contest.type) {
    case "most_fish":
      return `SELECT COUNT(*) AS score FROM fm_catches c WHERE ${where}`;
    case "biggest_fish":
      return `SELECT COALESCE(MAX(c.length_in), 0) AS score FROM fm_catches c WHERE ${where}`;
    case "most_over_size":
      return `SELECT COUNT(*) AS score FROM fm_catches c WHERE ${where} AND c.length_in >= ${t}`;
    case "most_over_size_daily_limit": {
      const dl = Number(contest.daily_limit);
      return `SELECT COALESCE(SUM(LEAST(n, ${dl})), 0) AS score FROM (
                SELECT DATE(c.caught_at) AS d, COUNT(*) AS n
                  FROM fm_catches c WHERE ${where} AND c.length_in >= ${t}
                 GROUP BY DATE(c.caught_at)
              ) day_q`;
    }
  }
}

/** Who may view a contest (detail/leaderboard). */
export async function canViewContest(
  contest: Contest,
  me: { id: string } | null,
  inviteCode?: string | null
): Promise<boolean> {
  if (contest.visibility === "public") return true;
  if (!me) return false;
  if (contest.creator_id === me.id) return true;
  if (contest.visibility === "invite") {
    if (inviteCode && inviteCode === contest.invite_code) return true;
    const joined = await queryOne(
      `SELECT 1 FROM fm_contest_entries WHERE contest_id = $1 AND user_id = $2`,
      [contest.id, me.id]
    );
    return joined !== null;
  }
  // friends visibility: creator's friends may view
  return areFriends(contest.creator_id, me.id);
}

export function makeInviteCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) s += chars[bytes[i] % chars.length];
  return s;
}
