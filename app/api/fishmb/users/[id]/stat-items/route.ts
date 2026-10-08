// /api/fishmb/users/[id]/stat-items — the items behind one stat tile.
// GET ?stat=catches|tournament-catches|species|tournaments|wins|posts
// Privacy mirrors getUserStats: the owner sees everything; everyone else sees
// public-visibility catches/posts, and approved (public-leaderboard) entries.

import { NextRequest, NextResponse } from "next/server";
import {
  fishUserFromRequest,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import { query, queryOne } from "@/lib/fish/db";
import { ensureTournamentTables, getLeaderboard } from "@/lib/fish/tournaments";
import { ensureFeedColumns } from "@/lib/fish/feed";

const STATS = [
  "catches",
  "tournament-catches",
  "species",
  "tournaments",
  "wins",
  "posts",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await ensureTournamentTables();
  await ensureFeedColumns();
  const userId = params.id;
  const stat = new URL(req.url).searchParams.get("stat");
  if (!stat || !(STATS as readonly string[]).includes(stat)) {
    return badRequest("Unknown stat.");
  }
  const user = await queryOne<{ id: string }>(
    `SELECT id FROM fm_users WHERE id = $1`,
    [userId]
  );
  if (!user) return notFound("User not found.");

  let me: { id: string } | null = null;
  try {
    me = await fishUserFromRequest(req);
  } catch {
    me = null;
  }
  const isSelf = !!me && me.id === userId;
  const pubCatches = isSelf ? "" : `AND visibility = 'public'`;
  const pubPosts = isSelf ? "" : `AND visibility = 'public'`;

  let items: unknown[] = [];
  if (stat === "catches") {
    items = await query(
      `SELECT id, species, length_in::float AS length_in, weight_lb::float AS weight_lb,
              photo_hold_url, note, caught_at
         FROM fm_catches
        WHERE user_id = $1 ${pubCatches}
        ORDER BY caught_at DESC LIMIT 100`,
      [userId]
    );
  } else if (stat === "tournament-catches") {
    items = await query(
      `SELECT e.id, e.tournament_id, t.name AS tournament_name, e.species,
              e.length_inches::float AS length_inches, e.photo_url, e.created_at
         FROM fm_tournament_entries e
         JOIN fm_tournaments t ON t.id = e.tournament_id
        WHERE e.user_id = $1 AND e.status = 'approved'
        ORDER BY e.created_at DESC LIMIT 100`,
      [userId]
    );
  } else if (stat === "species") {
    items = await query(
      `SELECT species, COUNT(*)::int AS count, MAX(length_in)::float AS best_in
         FROM (
           SELECT species, length_in FROM fm_catches WHERE user_id = $1 ${pubCatches}
           UNION ALL
           SELECT species, length_inches FROM fm_tournament_entries
            WHERE user_id = $1 AND status = 'approved'
         ) s
        GROUP BY species
        ORDER BY best_in DESC NULLS LAST, count DESC`,
      [userId]
    );
  } else if (stat === "tournaments" || stat === "wins") {
    const joined = await query<{
      id: string;
      name: string;
      status: string;
      starts_at: string;
      ends_at: string;
      scoring: string;
      participant_count: number;
    }>(
      `SELECT t.id, t.name, t.status, t.starts_at::text AS starts_at, t.ends_at::text AS ends_at,
              t.scoring,
              (SELECT COUNT(*)::int FROM fm_tournament_participants p WHERE p.tournament_id = t.id) AS participant_count
         FROM fm_tournaments t
         JOIN fm_tournament_participants p ON p.tournament_id = t.id AND p.user_id = $1
        ORDER BY t.starts_at DESC`,
      [userId]
    );
    if (stat === "tournaments") {
      items = joined;
    } else {
      // Wins: ended tournaments where this angler tops the leaderboard.
      const wins: typeof joined = [];
      for (const t of joined) {
        if (t.status !== "ended") continue;
        try {
          const board = await getLeaderboard(t.id, t.scoring);
          if (board.length > 0 && board[0].user_id === userId) wins.push(t);
        } catch {
          // Skip tournaments whose leaderboard can't be computed.
        }
      }
      items = wins;
    }
  } else if (stat === "posts") {
    items = await query(
      `SELECT id, body, kind, created_at
         FROM fm_discussions
        WHERE user_id = $1 AND kind = 'post' ${pubPosts}
        ORDER BY created_at DESC LIMIT 100`,
      [userId]
    );
  }

  return NextResponse.json({ stat, items });
}
