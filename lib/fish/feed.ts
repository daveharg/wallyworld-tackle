// FishMB community feed — same database as the app.
// Merges catch posts (fm_catches) and discussions (fm_discussions, kind='post')
// into one chronological feed. Visibility: 'public' or 'friends' (friends-only
// items are shown to the author and their accepted friends).

import { query } from "./db";

export interface FeedItem {
  id: string;
  kind: "catch" | "post";
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  body: string | null;
  photo_url: string | null;
  species: string | null;
  length_in: number | null;
  visibility: string;
  species_tag: string | null;
  comment_count: number;
  created_at: string;
}

export interface FeedComment {
  id: string;
  user_name: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
}

let ensured = false;

export async function ensureFeedColumns(): Promise<void> {
  if (ensured) return;
  await query(
    `ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'`
  );
  await query(`ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS species_tag text`);
  ensured = true;
}

/** SQL fragment: is $1 (viewer) allowed to see a row authored by `alias`? */
const VISIBLE_TO = (alias: string) => `
  (${alias}.visibility = 'public'
   OR ($1::uuid IS NOT NULL AND (${alias}.user_id = $1::uuid
     OR (${alias}.visibility = 'friends' AND EXISTS (
       SELECT 1 FROM fm_friendships f
       WHERE f.status = 'accepted'
         AND ((f.requester_id = $1::uuid AND f.addressee_id = ${alias}.user_id)
           OR (f.requester_id = ${alias}.user_id AND f.addressee_id = $1::uuid))
     )))))`;

export async function getFeed(
  limit = 30,
  offset = 0,
  viewerId: string | null = null
): Promise<FeedItem[]> {
  await ensureFeedColumns();
  const rows = await query<FeedItem>(
    `SELECT * FROM (
       SELECT c.id, 'catch' AS kind, c.user_id, u.name AS user_name, u.avatar_url,
              c.note AS body, c.photo_hold_url AS photo_url,
              c.species, c.length_in::float AS length_in,
              c.visibility, NULL AS species_tag,
              (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = c.id)::int AS comment_count,
              c.created_at
       FROM fm_catches c
       JOIN fm_users u ON u.id = c.user_id
       WHERE ${VISIBLE_TO("c")}
       UNION ALL
       SELECT d.id, 'post' AS kind, d.user_id, u.name AS user_name, u.avatar_url,
              d.body, d.photo_url,
              NULL AS species, NULL AS length_in,
              d.visibility, d.species_tag,
              (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = d.id)::int AS comment_count,
              d.created_at
       FROM fm_discussions d
       JOIN fm_users u ON u.id = d.user_id
       WHERE d.kind = 'post' AND ${VISIBLE_TO("d")}
     ) feed
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [viewerId, limit, offset]
  );
  return rows;
}

export async function createPost(
  userId: string,
  body: string,
  photoUrl: string | null,
  visibility: "public" | "friends" = "public",
  speciesTag: string | null = null
): Promise<FeedItem> {
  await ensureFeedColumns();
  const rows = await query<FeedItem>(
    `INSERT INTO fm_discussions (user_id, body, kind, photo_url, visibility, species_tag)
     VALUES ($1, $2, 'post', $3, $4, $5)
     RETURNING id, 'post' AS kind, user_id,
       (SELECT name FROM fm_users WHERE id = $1) AS user_name,
       (SELECT avatar_url FROM fm_users WHERE id = $1) AS avatar_url,
       body, photo_url, NULL AS species, NULL AS length_in,
       visibility, species_tag,
       0 AS comment_count, created_at`,
    [userId, body, photoUrl, visibility, speciesTag]
  );
  return rows[0];
}

/** Public fishing tips tagged to a species (for the how-to-fish pages). */
export async function getSpeciesTips(species: string, limit = 20): Promise<FeedItem[]> {
  await ensureFeedColumns();
  return query<FeedItem>(
    `SELECT d.id, 'post' AS kind, d.user_id, u.name AS user_name, u.avatar_url,
            d.body, d.photo_url, NULL AS species, NULL AS length_in,
            d.visibility, d.species_tag,
            (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = d.id)::int AS comment_count,
            d.created_at
     FROM fm_discussions d
     JOIN fm_users u ON u.id = d.user_id
     WHERE d.kind = 'post' AND d.visibility = 'public'
       AND LOWER(d.species_tag) = LOWER($1)
     ORDER BY d.created_at DESC
     LIMIT $2`,
    [species, limit]
  );
}

export async function getComments(postId: string): Promise<FeedComment[]> {
  return query<FeedComment>(
    `SELECT cm.id, u.name AS user_name, u.avatar_url, cm.body, cm.created_at
     FROM fm_comments cm
     JOIN fm_users u ON u.id = cm.user_id
     WHERE cm.post_id = $1
     ORDER BY cm.created_at ASC`,
    [postId]
  );
}

export async function addComment(postId: string, userId: string, body: string): Promise<FeedComment> {
  const rows = await query<FeedComment>(
    `INSERT INTO fm_comments (post_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id,
       (SELECT name FROM fm_users WHERE id = $2) AS user_name,
       (SELECT avatar_url FROM fm_users WHERE id = $2) AS avatar_url,
       body, created_at`,
    [postId, userId, body]
  );
  return rows[0];
}
