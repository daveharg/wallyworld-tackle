// GET /api/fishmb/users/[id] — public angler profile (Instagram-style).
// Returns identity, counts, photo grid, friends list, and the viewer's
// friendship status. Friends-only photos are visible to the owner and
// accepted friends only; everyone else sees public photos.

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import { fishUserFromRequest, notFound } from "@/lib/fish/auth";

interface ProfileUser {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
}

interface PhotoRow {
  photo_url: string;
  created_at: string;
  visibility: string;
}

interface FriendRow {
  id: string;
  name: string;
  avatar_url: string | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const target = await queryOne<ProfileUser>(
    `SELECT id, name, avatar_url, bio FROM fm_users WHERE id = $1`,
    [params.id]
  );
  if (!target) return notFound("Angler not found.");

  let viewerId: string | null = null;
  try {
    const me = await fishUserFromRequest(req);
    viewerId = me ? me.id : null;
  } catch {
    // guests see public content only
  }
  const isSelf = viewerId === target.id;

  // Friendship between viewer and target (for photo visibility + add-friend UI).
  let friendship: { status: string; requester_id: string } | null = null;
  let areFriends = false;
  if (viewerId && !isSelf) {
    friendship = await queryOne(
      `SELECT status, requester_id FROM fm_friendships
        WHERE ((requester_id = $1 AND addressee_id = $2)
           OR (requester_id = $2 AND addressee_id = $1))
          AND status IN ('pending', 'accepted')`,
      [viewerId, target.id]
    );
    areFriends = friendship?.status === "accepted";
  }

  const counts = await queryOne<{ posts: string; catches: string; friends: string }>(
    `SELECT
       (SELECT COUNT(*) FROM fm_discussions WHERE user_id = $1 AND kind = 'post') AS posts,
       (SELECT COUNT(*) FROM fm_catches WHERE user_id = $1) AS catches,
       (SELECT COUNT(*) FROM fm_friendships
          WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted') AS friends`,
    [target.id]
  );

  // Photo grid: latest photos from catches + posts. Friends-only items are
  // visible to the owner and accepted friends; everyone else gets public.
  const canSeeFriendsOnly = isSelf || areFriends;
  const photos = await query<PhotoRow>(
    `SELECT photo_url, created_at, visibility FROM (
       SELECT c.photo_hold_url AS photo_url, c.created_at, c.visibility
         FROM fm_catches c
        WHERE c.user_id = $1 AND c.photo_hold_url IS NOT NULL AND c.photo_hold_url <> ''
       UNION ALL
       SELECT d.photo_url, d.created_at, d.visibility
         FROM fm_discussions d
        WHERE d.user_id = $1 AND d.kind = 'post' AND d.photo_url IS NOT NULL AND d.photo_url <> ''
     ) p
     WHERE visibility = 'public' ${canSeeFriendsOnly ? "OR visibility = 'friends'" : ""}
     ORDER BY created_at DESC
     LIMIT 30`,
    [target.id]
  );

  const friends = await query<FriendRow>(
    `SELECT u.id, u.name, u.avatar_url
       FROM fm_friendships f
       JOIN fm_users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id = $1 OR f.addressee_id = $1)
        AND f.status = 'accepted'
      ORDER BY u.name ASC
      LIMIT 100`,
    [target.id]
  );

  return NextResponse.json({
    user: target,
    is_self: isSelf,
    friendship_status: friendship?.status ?? null,
    friendship_incoming: friendship?.status === "pending" && friendship.requester_id === target.id,
    counts: {
      posts: parseInt(counts?.posts ?? "0", 10),
      catches: parseInt(counts?.catches ?? "0", 10),
      friends: parseInt(counts?.friends ?? "0", 10),
    },
    photos: photos.map((p) => ({ url: p.photo_url, created_at: p.created_at })),
    friends,
  });
}
