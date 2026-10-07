// FishMB community feed — same database as the app.
// Merges catch posts (fm_catches) and discussions (fm_discussions, kind='post')
// into one chronological feed. Visibility: 'public' or 'friends' (friends-only
// items are shown to the author and their accepted friends).

import { query, queryOne } from "./db";

export interface FeedItem {
  id: string;
  kind: "catch" | "post";
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  body: string | null;
  photo_url: string | null;
  /** All attached photos (jsonb). photo_url is kept as the first photo for compat. */
  photos: string[];
  species: string | null;
  length_in: number | null;
  visibility: string;
  species_tag: string | null;
  comment_count: number;
  like_count: number;
  dislike_count: number;
  /** The viewer's own reaction, if any. */
  viewer_reaction: 1 | -1 | null;
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
  await query(`ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS photos jsonb`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS photos jsonb`);
  // Reactions live in one table keyed by post_id with NO foreign key, because a
  // "post" in the feed is either an fm_discussions row or an fm_catches row.
  await query(`CREATE TABLE IF NOT EXISTS fm_post_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    value smallint NOT NULL CHECK (value IN (1, -1)),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_post_reactions_post_idx ON fm_post_reactions(post_id)`
  );
  ensured = true;
}

/** Make sure the photos field is always a string array (jsonb comes back parsed). */
function normalizeFeedItem<T extends FeedItem>(row: T): T {
  const p: unknown = (row as { photos?: unknown }).photos;
  row.photos = Array.isArray(p)
    ? p.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  return row;
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

/** Escape LIKE wildcards so a search for "100%" doesn't match everything. */
function likePattern(q: string): string {
  return `%${q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

export async function getFeed(
  limit = 30,
  offset = 0,
  viewerId: string | null = null,
  q: string | null = null
): Promise<FeedItem[]> {
  await ensureFeedColumns();
  const search = q && q.trim() ? q.trim() : null;
  const params: unknown[] = [viewerId, limit, offset];
  let where = "";
  if (search) {
    params.push(likePattern(search));
    const p = `$${params.length}`;
    where = `WHERE (feed.body ILIKE ${p} ESCAPE '\\'
                 OR feed.species ILIKE ${p} ESCAPE '\\'
                 OR feed.user_name ILIKE ${p} ESCAPE '\\')`;
  }
  const rows = await query<FeedItem>(
    `SELECT feed.*,
            (SELECT COUNT(*) FROM fm_post_reactions r
              WHERE r.post_id = feed.id AND r.value = 1)::int AS like_count,
            (SELECT COUNT(*) FROM fm_post_reactions r
              WHERE r.post_id = feed.id AND r.value = -1)::int AS dislike_count,
            (SELECT r.value FROM fm_post_reactions r
              WHERE r.post_id = feed.id AND r.user_id = $1::uuid)::smallint AS viewer_reaction
     FROM (
       SELECT c.id, 'catch' AS kind, c.user_id, u.name AS user_name, u.avatar_url,
              c.note AS body, c.photo_hold_url AS photo_url,
              COALESCE(c.photos, '[]'::jsonb) AS photos,
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
              COALESCE(d.photos, '[]'::jsonb) AS photos,
              NULL AS species, NULL AS length_in,
              d.visibility, d.species_tag,
              (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = d.id)::int AS comment_count,
              d.created_at
       FROM fm_discussions d
       JOIN fm_users u ON u.id = d.user_id
       WHERE d.kind = 'post' AND ${VISIBLE_TO("d")}
     ) feed
     ${where}
     ORDER BY feed.created_at DESC
     LIMIT $2 OFFSET $3`,
    params
  );
  return rows.map(normalizeFeedItem);
}

export async function createPost(
  userId: string,
  body: string,
  photoUrl: string | null,
  visibility: "public" | "friends" = "public",
  speciesTag: string | null = null,
  photos: string[] = []
): Promise<FeedItem> {
  await ensureFeedColumns();
  const finalPhotos = photos.length > 0 ? photos : photoUrl ? [photoUrl] : [];
  const finalPhotoUrl = finalPhotos[0] ?? null;
  const rows = await query<FeedItem>(
    `INSERT INTO fm_discussions (user_id, body, kind, photo_url, photos, visibility, species_tag)
     VALUES ($1, $2, 'post', $3, $4::jsonb, $5, $6)
     RETURNING id, 'post' AS kind, user_id,
       (SELECT name FROM fm_users WHERE id = $1) AS user_name,
       (SELECT avatar_url FROM fm_users WHERE id = $1) AS avatar_url,
       body, photo_url, photos, NULL AS species, NULL AS length_in,
       visibility, species_tag,
       0 AS comment_count,
       0 AS like_count, 0 AS dislike_count, NULL::smallint AS viewer_reaction,
       created_at`,
    [userId, body, finalPhotoUrl, JSON.stringify(finalPhotos), visibility, speciesTag]
  );
  return normalizeFeedItem(rows[0]);
}

/** Toggle the viewer's reaction: 1 = like, -1 = dislike, null = remove. */
export async function toggleReaction(
  postId: string,
  userId: string,
  value: 1 | -1 | null
): Promise<{ like_count: number; dislike_count: number; viewer_reaction: 1 | -1 | null }> {
  await ensureFeedColumns();
  if (value === null) {
    await query(`DELETE FROM fm_post_reactions WHERE post_id = $1 AND user_id = $2`, [
      postId,
      userId,
    ]);
  } else {
    await query(
      `INSERT INTO fm_post_reactions (post_id, user_id, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (post_id, user_id) DO UPDATE SET value = EXCLUDED.value`,
      [postId, userId, value]
    );
  }
  const row = await queryOne<{ like_count: number; dislike_count: number; viewer_reaction: number | null }>(
    `SELECT COUNT(*) FILTER (WHERE value = 1)::int AS like_count,
            COUNT(*) FILTER (WHERE value = -1)::int AS dislike_count,
            (SELECT value FROM fm_post_reactions WHERE post_id = $1 AND user_id = $2)::int AS viewer_reaction
     FROM fm_post_reactions
     WHERE post_id = $1`,
    [postId, userId]
  );
  const vr = row?.viewer_reaction;
  return {
    like_count: row?.like_count ?? 0,
    dislike_count: row?.dislike_count ?? 0,
    viewer_reaction: vr === 1 || vr === -1 ? vr : null,
  };
}

/** Public fishing tips tagged to a species (for the how-to-fish pages). */
export async function getSpeciesTips(species: string, limit = 20): Promise<FeedItem[]> {
  await ensureFeedColumns();
  const rows = await query<FeedItem>(
    `SELECT d.id, 'post' AS kind, d.user_id, u.name AS user_name, u.avatar_url,
            d.body, d.photo_url, COALESCE(d.photos, '[]'::jsonb) AS photos,
            NULL AS species, NULL AS length_in,
            d.visibility, d.species_tag,
            (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = d.id)::int AS comment_count,
            0 AS like_count, 0 AS dislike_count, NULL::smallint AS viewer_reaction,
            d.created_at
     FROM fm_discussions d
     JOIN fm_users u ON u.id = d.user_id
     WHERE d.kind = 'post' AND d.visibility = 'public'
       AND LOWER(d.species_tag) = LOWER($1)
     ORDER BY d.created_at DESC
     LIMIT $2`,
    [species, limit]
  );
  return rows.map(normalizeFeedItem);
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
