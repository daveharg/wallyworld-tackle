// /api/fishmb/users/[id]/stat-leaderboard — you vs your friends for one stat.
// GET ?stat=catches|tournament-catches|species|tournaments|wins|posts
// Values match what each person sees on their tiles: the profile owner uses
// viewer-aware visibility, friends always use public-only numbers.

import { NextRequest, NextResponse } from "next/server";
import { fishUserFromRequest, badRequest, notFound } from "@/lib/fish/auth";
import { query, queryOne } from "@/lib/fish/db";
import { getUserStats, type UserStats } from "@/lib/fish/stats";

const STATS = [
  "catches",
  "tournament-catches",
  "species",
  "tournaments",
  "wins",
  "posts",
] as const;

function statValue(s: UserStats, stat: string): number {
  switch (stat) {
    case "catches":
      return s.total_catches;
    case "tournament-catches":
      return s.tournament_catches;
    case "species":
      return s.species_count;
    case "tournaments":
      return s.tournaments_joined;
    case "wins":
      return s.tournament_wins;
    case "posts":
      return s.posts_count;
    default:
      return 0;
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = params.id;
  const stat = new URL(req.url).searchParams.get("stat");
  if (!stat || !(STATS as readonly string[]).includes(stat)) {
    return badRequest("Unknown stat.");
  }
  const user = await queryOne<{ id: string }>(`SELECT id FROM fm_users WHERE id = $1`, [
    userId,
  ]);
  if (!user) return notFound("User not found.");

  let me: { id: string } | null = null;
  try {
    me = await fishUserFromRequest(req);
  } catch {
    me = null;
  }
  const viewerId = me?.id ?? null;

  // Accepted friends of the profile owner.
  const friends = await query<{ id: string; name: string; avatar_url: string | null }>(
    `SELECT u.id, u.name, u.avatar_url
       FROM fm_friendships f
       JOIN fm_users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)`,
    [userId]
  );
  const owner = await queryOne<{ id: string; name: string; avatar_url: string | null }>(
    `SELECT id, name, avatar_url FROM fm_users WHERE id = $1`,
    [userId]
  );

  const rows: { user_id: string; name: string; avatar_url: string | null; value: number; is_you: boolean }[] = [];
  // The owner: viewer-aware (full numbers when viewing your own stats).
  const ownerStats = await getUserStats(userId, viewerId);
  if (ownerStats && owner) {
    rows.push({
      user_id: owner.id,
      name: owner.name,
      avatar_url: owner.avatar_url,
      value: statValue(ownerStats, stat),
      is_you: viewerId !== null && viewerId === userId,
    });
  }
  // Friends: public-only numbers, same as their tiles show to you.
  for (const f of friends) {
    try {
      const s = await getUserStats(f.id, null);
      if (!s) continue;
      rows.push({
        user_id: f.id,
        name: f.name,
        avatar_url: f.avatar_url,
        value: statValue(s, stat),
        is_you: false,
      });
    } catch {
      // Skip friends whose stats can't be computed.
    }
  }
  rows.sort((a, b) => b.value - a.value);

  return NextResponse.json({ stat, rows });
}
