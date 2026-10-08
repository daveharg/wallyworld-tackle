// Shared stats builders.
//
// - buildStats: legacy minimal per-species aggregates, used by the Expo app's
//   /api/fish/users/*/stats routes. Do not change its shape.
// - getUserStats / getAllUserStats: full FishMB website stats (feed catches,
//   tournament catches + wins, posts, tips, biggest fish) with visibility-aware
//   privacy. Only aggregates — never returns individual private catches.

import { query, queryOne } from "./db";
import { ensureTournamentTables, getLeaderboard } from "./tournaments";
import { ensureFeedColumns } from "./feed";
import { ensureProfileColumns } from "./auth";

export interface LegacyUserStats {
  total_catches: number;
  species_count: number;
  biggest_overall_in: number | null;
  biggest_by_species: Array<{ species: string; best_in: number; count: number }>;
}

export async function buildStats(userId: string): Promise<LegacyUserStats> {
  const rows = await query<{ species: string; best_in: string; count: string }>(
    `SELECT species, MAX(length_in) AS best_in, COUNT(*) AS count
       FROM fm_catches
      WHERE user_id = $1
      GROUP BY species
      ORDER BY MAX(length_in) DESC`,
    [userId]
  );
  const total = rows.reduce((n, r) => n + Number(r.count), 0);
  const biggest = rows.length > 0 ? Number(rows[0].best_in) : null;
  return {
    total_catches: total,
    species_count: rows.length,
    biggest_overall_in: biggest,
    biggest_by_species: rows.map((r) => ({
      species: r.species,
      best_in: Number(r.best_in),
      count: Number(r.count),
    })),
  };
}

// ---------------------------------------------------------------------------
// FishMB website stats
// ---------------------------------------------------------------------------

export interface BiggestFish {
  species: string;
  length_in: number;
}

export interface UserStats {
  user_id: string;
  total_catches: number;
  tournament_catches: number;
  species_count: number;
  biggest: BiggestFish[];
  tournaments_joined: number;
  tournament_wins: number;
  posts_count: number;
  tips_count: number;
  member_since: string | null;
  /** Stat keys this angler hides from other people. */
  hidden_stats: string[];
  /** Whether the viewer is the profile owner. */
  is_self: boolean;
}

/** Valid keys for the hidden_stats privacy list. */
export const STAT_KEYS = [
  "catches",
  "tournament-catches",
  "species",
  "tournaments",
  "wins",
  "posts",
  "biggest",
] as const;

/** The stat keys one user hides from everyone else. */
export async function getHiddenStats(userId: string): Promise<string[]> {
  await ensureProfileColumns();
  const row = await queryOne<{ hidden_stats: string[] | null }>(
    `SELECT hidden_stats FROM fm_users WHERE id = $1`,
    [userId]
  );
  const raw = row?.hidden_stats ?? [];
  return raw.filter((k): k is string => (STAT_KEYS as readonly string[]).includes(k));
}

export interface AdminUserStats extends UserStats {
  name: string;
  avatar_url: string | null;
}

async function ensureAll() {
  await ensureTournamentTables();
  await ensureFeedColumns();
}

/** Distinct species across feed catches + approved tournament entries. */
async function speciesCount(userId: string, publicOnly: boolean): Promise<number> {
  const vis = publicOnly ? `AND visibility = 'public'` : ``;
  const row = await queryOne<{ c: string }>(
    `SELECT COUNT(DISTINCT species)::text AS c FROM (
       SELECT species FROM fm_catches WHERE user_id = $1 ${vis}
       UNION ALL
       SELECT species FROM fm_tournament_entries WHERE user_id = $1 AND status = 'approved'
     ) s`,
    [userId]
  );
  return Number(row?.c ?? 0);
}

/** Top-5 biggest fish across feed catches + approved tournament entries. */
async function biggestFor(userId: string, publicOnly: boolean): Promise<BiggestFish[]> {
  const vis = publicOnly ? `AND c.visibility = 'public'` : ``;
  const rows = await query<{ species: string; length_in: number }>(
    `SELECT species, length_in::float AS length_in FROM (
       SELECT c.species AS species, c.length_in AS length_in
       FROM fm_catches c WHERE c.user_id = $1 ${vis} AND c.length_in IS NOT NULL
       UNION ALL
       SELECT e.species, e.length_inches
       FROM fm_tournament_entries e
       WHERE e.user_id = $1 AND e.status = 'approved' AND e.length_inches IS NOT NULL
     ) s ORDER BY length_in DESC LIMIT 5`,
    [userId]
  );
  return rows.map((r) => ({ species: r.species, length_in: Number(r.length_in) }));
}

/**
 * Full stats for one angler. viewerId === userId sees everything; anyone else
 * (including logged-out, viewerId = null) sees only public-visibility feed
 * catches. Approved tournament entries are on public leaderboards, so they
 * count for everyone. Returns null when the user doesn't exist.
 */
export async function getUserStats(
  userId: string,
  viewerId: string | null
): Promise<UserStats | null> {
  await ensureAll();
  const user = await queryOne<{ id: string; created_at: string | null }>(
    `SELECT id, created_at::text AS created_at FROM fm_users WHERE id = $1`,
    [userId]
  );
  if (!user) return null;
  const isSelf = viewerId !== null && viewerId === userId;
  const publicOnly = !isSelf;
  const vis = publicOnly ? `AND visibility = 'public'` : ``;
  const hidden = await getHiddenStats(userId);
  const hide = (key: string) => !isSelf && hidden.includes(key);

  const catches = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM fm_catches WHERE user_id = $1 ${vis}`,
    [userId]
  );
  const tEntries = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM fm_tournament_entries WHERE user_id = $1 AND status = 'approved'`,
    [userId]
  );
  const joined = await queryOne<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM fm_tournament_participants WHERE user_id = $1`,
    [userId]
  );
  const posts = await queryOne<{ p: string; t: string }>(
    `SELECT COUNT(*) FILTER (WHERE kind = 'post')::text AS p,
            COUNT(*) FILTER (WHERE kind = 'tip')::text AS t
     FROM fm_discussions WHERE user_id = $1`,
    [userId]
  );

  // Wins: ended tournaments this angler joined where they rank #1.
  let wins = 0;
  const ended = await query<{ id: string; scoring: string }>(
    `SELECT t.id, t.scoring FROM fm_tournaments t
     JOIN fm_tournament_participants p ON p.tournament_id = t.id
     WHERE p.user_id = $1 AND t.status = 'ended'
     ORDER BY p.joined_at DESC LIMIT 50`,
    [userId]
  );
  for (const t of ended) {
    const board = await getLeaderboard(t.id, t.scoring);
    if (board.length > 0 && board[0].user_id === userId) wins++;
  }

  return {
    user_id: userId,
    total_catches: hide("catches") ? 0 : Number(catches?.c ?? 0),
    tournament_catches: hide("tournament-catches") ? 0 : Number(tEntries?.c ?? 0),
    species_count: hide("species") ? 0 : await speciesCount(userId, publicOnly),
    biggest: hide("biggest") ? [] : await biggestFor(userId, publicOnly),
    tournaments_joined: hide("tournaments") ? 0 : Number(joined?.c ?? 0),
    tournament_wins: hide("wins") ? 0 : wins,
    posts_count: hide("posts") ? 0 : Number(posts?.p ?? 0),
    tips_count: Number(posts?.t ?? 0),
    member_since: user.created_at,
    hidden_stats: hidden,
    is_self: isSelf,
  };
}

/**
 * Public-facing stats for every angler (admin view). Batched aggregates keep
 * this to a handful of queries; wins are computed once per ended tournament
 * rather than once per user.
 */
export async function getAllUserStats(limit = 500): Promise<AdminUserStats[]> {
  await ensureAll();
  const users = await query<{
    id: string;
    name: string;
    avatar_url: string | null;
    created_at: string | null;
  }>(
    `SELECT id, name, avatar_url, created_at::text AS created_at
     FROM fm_users ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  if (users.length === 0) return [];
  const ids = users.map((u) => u.id);

  const byId = new Map<string, AdminUserStats>();
  for (const u of users) {
    byId.set(u.id, {
      user_id: u.id,
      name: u.name,
      avatar_url: u.avatar_url,
      total_catches: 0,
      tournament_catches: 0,
      species_count: 0,
      biggest: [],
      tournaments_joined: 0,
      tournament_wins: 0,
      posts_count: 0,
      tips_count: 0,
      member_since: u.created_at,
      hidden_stats: [],
      is_self: false,
    });
  }

  const catches = await query<{ user_id: string; c: string }>(
    `SELECT user_id, COUNT(*)::text AS c FROM fm_catches
     WHERE user_id = ANY($1) AND visibility = 'public' GROUP BY user_id`,
    [ids]
  );
  for (const r of catches) byId.get(r.user_id)!.total_catches = Number(r.c);

  const tCatches = await query<{ user_id: string; c: string }>(
    `SELECT user_id, COUNT(*)::text AS c FROM fm_tournament_entries
     WHERE user_id = ANY($1) AND status = 'approved' GROUP BY user_id`,
    [ids]
  );
  for (const r of tCatches) byId.get(r.user_id)!.tournament_catches = Number(r.c);

  const species = await query<{ user_id: string; c: string }>(
    `SELECT user_id, COUNT(DISTINCT species)::text AS c FROM (
       SELECT user_id, species FROM fm_catches WHERE user_id = ANY($1) AND visibility = 'public'
       UNION ALL
       SELECT user_id, species FROM fm_tournament_entries WHERE user_id = ANY($1) AND status = 'approved'
     ) s GROUP BY user_id`,
    [ids]
  );
  for (const r of species) byId.get(r.user_id)!.species_count = Number(r.c);

  const joined = await query<{ user_id: string; c: string }>(
    `SELECT user_id, COUNT(*)::text AS c FROM fm_tournament_participants
     WHERE user_id = ANY($1) GROUP BY user_id`,
    [ids]
  );
  for (const r of joined) byId.get(r.user_id)!.tournaments_joined = Number(r.c);

  const posts = await query<{ user_id: string; p: string; t: string }>(
    `SELECT user_id,
            COUNT(*) FILTER (WHERE kind = 'post')::text AS p,
            COUNT(*) FILTER (WHERE kind = 'tip')::text AS t
     FROM fm_discussions WHERE user_id = ANY($1) GROUP BY user_id`,
    [ids]
  );
  for (const r of posts) {
    const s = byId.get(r.user_id)!;
    s.posts_count = Number(r.p);
    s.tips_count = Number(r.t);
  }

  const big = await query<{ user_id: string; species: string; length_in: number }>(
    `SELECT user_id, species, length_in::float AS length_in FROM (
       SELECT user_id, species, length_in,
              ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY length_in DESC) AS rn
       FROM fm_catches WHERE user_id = ANY($1) AND visibility = 'public' AND length_in IS NOT NULL
       UNION ALL
       SELECT user_id, species, length_inches,
              ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY length_inches DESC) AS rn
       FROM fm_tournament_entries WHERE user_id = ANY($1) AND status = 'approved' AND length_inches IS NOT NULL
     ) s WHERE rn <= 5 ORDER BY user_id, length_in DESC`,
    [ids]
  );
  const bigByUser = new Map<string, BiggestFish[]>();
  for (const r of big) {
    const arr = bigByUser.get(r.user_id) ?? [];
    arr.push({ species: r.species, length_in: Number(r.length_in) });
    bigByUser.set(r.user_id, arr);
  }
  bigByUser.forEach((arr, uid) => {
    arr.sort((a, b) => b.length_in - a.length_in);
    byId.get(uid)!.biggest = arr.slice(0, 5);
  });

  // Wins: one leaderboard per ended tournament with participants, credit #1.
  const ended = await query<{ id: string; scoring: string }>(
    `SELECT t.id, t.scoring FROM fm_tournaments t
     WHERE t.status = 'ended'
       AND EXISTS (SELECT 1 FROM fm_tournament_participants p WHERE p.tournament_id = t.id)`
  );
  for (const t of ended) {
    const board = await getLeaderboard(t.id, t.scoring);
    if (board.length > 0) {
      const w = byId.get(board[0].user_id);
      if (w) w.tournament_wins++;
    }
  }

  return users.map((u) => byId.get(u.id)!);
}
