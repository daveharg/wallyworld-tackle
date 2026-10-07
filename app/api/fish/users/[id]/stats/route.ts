// GET /api/fish/users/[id]/stats — another angler's stats.
// Allowed when: it's you, their stats are public, or you're friends.
// Otherwise 403. Never exposes individual catches.

import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  areFriends,
  forbidden,
  notFound,
  type FishUser,
} from "@/lib/fish/auth";
import { buildStats } from "@/lib/fish/stats";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await fishUserFromRequest(req);

  const target = await queryOne<FishUser>(`SELECT * FROM fm_users WHERE id = $1`, [id]);
  if (!target) return notFound("User not found.");

  const isSelf = me?.id === target.id;
  const allowed =
    isSelf ||
    target.stats_public ||
    (me !== null && (await areFriends(me.id, target.id)));
  if (!allowed) return forbidden("This angler's stats are not shared with you.");

  const stats = await buildStats(target.id);
  return NextResponse.json({
    user: { id: target.id, name: target.name, avatar_url: target.avatar_url },
    ...stats,
  });
}
