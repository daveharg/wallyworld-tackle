// FishMB community feed — same database as the app.
// Merges public catch posts (fm_catches, visibility='public') and
// discussions (fm_discussions, kind='post') into one chronological feed.

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

export async function getFeed(limit = 30, offset = 0): Promise<FeedItem[]> {
  const rows = await query<FeedItem>(
    `SELECT * FROM (
       SELECT c.id, 'catch' AS kind, c.user_id, u.name AS user_name, u.avatar_url,
              c.note AS body, c.photo_hold_url AS photo_url,
              c.species, c.length_in::float AS length_in,
              (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = c.id)::int AS comment_count,
              c.created_at
       FROM fm_catches c
       JOIN fm_users u ON u.id = c.user_id
       WHERE c.visibility = 'public'
       UNION ALL
       SELECT d.id, 'post' AS kind, d.user_id, u.name AS user_name, u.avatar_url,
              d.body, d.photo_url,
              NULL AS species, NULL AS length_in,
              (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = d.id)::int AS comment_count,
              d.created_at
       FROM fm_discussions d
       JOIN fm_users u ON u.id = d.user_id
       WHERE d.kind = 'post'
     ) feed
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function createPost(userId: string, body: string, photoUrl: string | null): Promise<FeedItem> {
  const rows = await query<FeedItem>(
    `INSERT INTO fm_discussions (user_id, body, kind, photo_url)
     VALUES ($1, $2, 'post', $3)
     RETURNING id, 'post' AS kind, user_id,
       (SELECT name FROM fm_users WHERE id = $1) AS user_name,
       (SELECT avatar_url FROM fm_users WHERE id = $1) AS avatar_url,
       body, photo_url, NULL AS species, NULL AS length_in,
       0 AS comment_count, created_at`,
    [userId, body, photoUrl]
  );
  return rows[0];
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
