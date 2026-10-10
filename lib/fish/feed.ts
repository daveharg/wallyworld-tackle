// FishMB community feed — same database as the app.
// Merges catch posts (fm_catches) and discussions (fm_discussions, kind='post')
// into one chronological feed. Visibility: 'public' or 'friends' (friends-only
// items are shown to the author and their accepted friends).

import { query, queryOne } from "./db";

export interface FeedItem {
  id: string;
  kind: "catch" | "post" | "tip";
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  body: string | null;
  photo_url: string | null;
  /** All attached photos (jsonb). photo_url is kept as the first photo for compat. */
  photos: string[];
  /** Optional video: { playback_id, duration } — bytes live on Mux. */
  video: { playback_id: string; duration: number | null } | null;
  /** A shared fishing spot: { name, lat, lng, notes, icon } — tap to view/save. */
  spot_share: { name: string; lat: number; lng: number; notes: string; icon: string } | null;
  species: string | null;
  length_in: number | null;
  visibility: string;
  species_tag: string | null;
  comment_count: number;
  like_count: number;
  dislike_count: number;
  laugh_count: number;
  /** The viewer's own reaction, if any. */
  viewer_reaction: 1 | -1 | 2 | null;
  created_at: string;
}

export interface FeedComment {
  id: string;
  user_id?: string;
  user_name: string;
  avatar_url: string | null;
  body: string;
  photo_url: string | null;
  parent_id: string | null;
  like_count: number;
  dislike_count: number;
  viewer_reaction: 1 | -1 | null;
  created_at: string;
}

let ensured = false;

export async function ensureFeedColumns(): Promise<void> {
  if (ensured) return;
  await query(
    `ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'`
  );
  await query(`ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS species_tag text`);
  // Tips can opt out of the community feed (they always show on the species page).
  await query(`ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS in_feed boolean NOT NULL DEFAULT true`);
  await query(`ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS photos jsonb`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS photos jsonb`);
  // Optional video per post/catch: { playback_id, duration } — video bytes live
  // on Mux (converted + served by them), we only keep the playback reference.
  await query(`ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS video jsonb`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS video jsonb`);
  // A shared fishing spot on a post: { name, lat, lng, notes, icon }.
  await query(`ALTER TABLE fm_discussions ADD COLUMN IF NOT EXISTS spot_share jsonb`);
  // Comments can carry one photo.
  await query(`ALTER TABLE fm_comments ADD COLUMN IF NOT EXISTS photo_url text`);
  // Comments can target either an fm_discussions row or an fm_catches row, so
  // post_id carries NO foreign key (the original 003.sql FK to fm_discussions
  // broke commenting on catches). Keep the post_id index for lookups.
  await query(`ALTER TABLE fm_comments DROP CONSTRAINT IF EXISTS fm_comments_post_id_fkey`);
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
  // Nested replies: a comment can reply to another comment on the same post.
  await query(`ALTER TABLE fm_comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES fm_comments(id) ON DELETE CASCADE`);
  await query(`CREATE INDEX IF NOT EXISTS fm_comments_parent_idx ON fm_comments(parent_id)`);
  // Like/dislike on comments (same 1/-1 pattern as post reactions).
  await query(`CREATE TABLE IF NOT EXISTS fm_comment_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid NOT NULL REFERENCES fm_comments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    value smallint NOT NULL CHECK (value IN (1, -1)),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (comment_id, user_id)
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_comment_reactions_comment_idx ON fm_comment_reactions(comment_id)`
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
     ))
     OR (${alias}.visibility = 'followers' AND EXISTS (
       SELECT 1 FROM fm_follows fo
       WHERE fo.follower_id = $1::uuid AND fo.followee_id = ${alias}.user_id
     )))))`;

/** Escape LIKE wildcards so a search for "100%" doesn't match everything. */
function likePattern(q: string): string {
  return `%${q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

export interface FeedCursor {
  before: string; // ISO timestamp of the last item on the previous page
  beforeId: string; // id of the last item (tiebreak for equal timestamps)
}

export interface GetFeedOptions {
  limit?: number;
  viewerId?: string | null;
  q?: string | null;
  kind?: "all" | "catch" | "post";
  friendsOnly?: boolean;
  cursor?: FeedCursor | null;
}

export interface FeedPage {
  items: FeedItem[];
  hasMore: boolean;
}

export async function getFeed(opts: GetFeedOptions = {}): Promise<FeedPage> {
  const { limit = 30, viewerId = null, q = null, kind = "all", friendsOnly = false, cursor = null } = opts;
  await ensureFeedColumns();
  const search = q && q.trim() ? q.trim() : null;
  const params: unknown[] = [viewerId];
  let where = "";
  if (friendsOnly) {
    await ensureFollowTables();
    where = `WHERE ($1::uuid IS NOT NULL AND (feed.user_id = $1::uuid OR EXISTS (
       SELECT 1 FROM fm_friendships f
       WHERE f.status = 'accepted'
         AND ((f.requester_id = $1::uuid AND f.addressee_id = feed.user_id)
           OR (f.requester_id = feed.user_id AND f.addressee_id = $1::uuid)))
       OR EXISTS (
       SELECT 1 FROM fm_follows fo
       WHERE fo.follower_id = $1::uuid AND fo.followee_id = feed.user_id)))`;
  }
  if (search) {
    params.push(likePattern(search));
    const p = `$${params.length}`;
    const clause = `(feed.body ILIKE ${p} ESCAPE '\\'
                 OR feed.species ILIKE ${p} ESCAPE '\\'
                 OR feed.user_name ILIKE ${p} ESCAPE '\\')`;
    where = where ? `${where} AND ${clause}` : `WHERE ${clause}`;
  }
  if (cursor) {
    params.push(cursor.before, cursor.beforeId);
    const t = `$${params.length - 1}`;
    const i = `$${params.length}`;
    const clause = `(feed.created_at < ${t}::timestamptz OR (feed.created_at = ${t}::timestamptz AND feed.id < ${i}))`;
    where = where ? `${where} AND ${clause}` : `WHERE ${clause}`;
  }
  // Kind filter applies inside each UNION branch so cursor pages stay stable.
  const catchWhere = kind === "post" ? "AND FALSE" : "";
  const postWhere = kind === "catch" ? "AND FALSE" : "";
  const rows = await query<FeedItem>(
    `SELECT feed.*,
            (SELECT COUNT(*) FROM fm_post_reactions r
              WHERE r.post_id = feed.id AND r.value = 1)::int AS like_count,
            (SELECT COUNT(*) FROM fm_post_reactions r
              WHERE r.post_id = feed.id AND r.value = -1)::int AS dislike_count,
            (SELECT COUNT(*) FROM fm_post_reactions r
              WHERE r.post_id = feed.id AND r.value = 2)::int AS laugh_count,
            (SELECT r.value FROM fm_post_reactions r
              WHERE r.post_id = feed.id AND r.user_id = $1::uuid)::smallint AS viewer_reaction
     FROM (
       SELECT c.id, 'catch' AS kind, c.user_id, u.name AS user_name, u.avatar_url,
              c.note AS body, c.photo_hold_url AS photo_url,
              COALESCE(c.photos, '[]'::jsonb) AS photos,
              c.video AS video,
              NULL AS spot_share,
              c.species, c.length_in::float AS length_in,
              c.visibility, NULL AS species_tag,
              (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = c.id)::int AS comment_count,
              c.created_at
       FROM fm_catches c
       JOIN fm_users u ON u.id = c.user_id
       WHERE ${VISIBLE_TO("c")} ${catchWhere}
       UNION ALL
       SELECT d.id, d.kind, d.user_id, u.name AS user_name, u.avatar_url,
              d.body, d.photo_url,
              COALESCE(d.photos, '[]'::jsonb) AS photos,
              d.video AS video,
              d.spot_share AS spot_share,
              NULL AS species, NULL AS length_in,
              d.visibility, d.species_tag,
              (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = d.id)::int AS comment_count,
              d.created_at
       FROM fm_discussions d
       JOIN fm_users u ON u.id = d.user_id
       WHERE d.kind IN ('post', 'tip') AND d.in_feed AND ${VISIBLE_TO("d")} ${postWhere}
     ) feed
     ${where}
     ORDER BY feed.created_at DESC, feed.id DESC
     LIMIT $${params.length + 1}`,
    [...params, limit + 1]
  );
  const hasMore = rows.length > limit;
  return { items: rows.slice(0, limit).map(normalizeFeedItem), hasMore };
}

export async function createPost(
  userId: string,
  body: string,
  photoUrl: string | null,
  visibility: "public" | "friends" = "public",
  speciesTag: string | null = null,
  photos: string[] = [],
  video: { playback_id: string; duration: number | null } | null = null
): Promise<FeedItem> {
  await ensureFeedColumns();
  const finalPhotos = photos.length > 0 ? photos : photoUrl ? [photoUrl] : [];
  const finalPhotoUrl = finalPhotos[0] ?? null;
  const rows = await query<FeedItem>(
    `INSERT INTO fm_discussions (user_id, body, kind, photo_url, photos, video, visibility, species_tag)
     VALUES ($1, $2, 'post', $3, $4::jsonb, $5::jsonb, $6, $7)
     RETURNING id, 'post' AS kind, user_id,
       (SELECT name FROM fm_users WHERE id = $1) AS user_name,
       (SELECT avatar_url FROM fm_users WHERE id = $1) AS avatar_url,
       body, photo_url, photos, video, NULL AS species, NULL AS length_in,
       visibility, species_tag,
       0 AS comment_count,
       0 AS like_count, 0 AS dislike_count, NULL::smallint AS viewer_reaction,
       created_at`,
    [userId, body, finalPhotoUrl, JSON.stringify(finalPhotos), video ? JSON.stringify(video) : null, visibility, speciesTag]
  );
  return normalizeFeedItem(rows[0]);
}

/** Toggle the viewer's reaction: 1 = like, -1 = dislike, null = remove. */
export async function toggleReaction(
  postId: string,
  userId: string,
  value: 1 | -1 | 2 | null
): Promise<{ like_count: number; dislike_count: number; laugh_count: number; viewer_reaction: 1 | -1 | 2 | null }> {
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
  const row = await queryOne<{ like_count: number; dislike_count: number; laugh_count: number; viewer_reaction: number | null }>(
    `SELECT COUNT(*) FILTER (WHERE value = 1)::int AS like_count,
            COUNT(*) FILTER (WHERE value = -1)::int AS dislike_count,
            COUNT(*) FILTER (WHERE value = 2)::int AS laugh_count,
            (SELECT value FROM fm_post_reactions WHERE post_id = $1 AND user_id = $2)::int AS viewer_reaction
     FROM fm_post_reactions
     WHERE post_id = $1`,
    [postId, userId]
  );
  const vr = row?.viewer_reaction;
  return {
    like_count: row?.like_count ?? 0,
    dislike_count: row?.dislike_count ?? 0,
    laugh_count: row?.laugh_count ?? 0,
    viewer_reaction: vr === 1 || vr === -1 || vr === 2 ? vr : null,
  };
}

/** Public fishing tips tagged to a species (for the how-to-fish pages). */
export async function getSpeciesTips(species: string, limit = 20): Promise<FeedItem[]> {
  await ensureFeedColumns();
  const rows = await query<FeedItem>(
    `SELECT d.id, d.kind, d.user_id, u.name AS user_name, u.avatar_url,
            d.body, d.photo_url, COALESCE(d.photos, '[]'::jsonb) AS photos,
            d.video AS video,
            d.spot_share AS spot_share,
            NULL AS species, NULL AS length_in,
            d.visibility, d.species_tag,
            (SELECT COUNT(*) FROM fm_comments cm WHERE cm.post_id = d.id)::int AS comment_count,
            0 AS like_count, 0 AS dislike_count, NULL::smallint AS viewer_reaction,
            d.created_at
     FROM fm_discussions d
     JOIN fm_users u ON u.id = d.user_id
     WHERE d.kind IN ('post', 'tip') AND d.visibility = 'public'
       AND LOWER(d.species_tag) = LOWER($1)
     ORDER BY d.created_at DESC
     LIMIT $2`,
    [species, limit]
  );
  return rows.map(normalizeFeedItem);
}

export async function getComments(postId: string, viewerId?: string): Promise<FeedComment[]> {
  await ensureFeedColumns();
  const rows = await query<FeedComment>(
    `SELECT cm.id, cm.user_id::text AS user_id, u.name AS user_name, u.avatar_url, cm.body,
            cm.photo_url,
            cm.parent_id::text AS parent_id,
            (SELECT COUNT(*) FROM fm_comment_reactions r WHERE r.comment_id = cm.id AND r.value = 1)::int AS like_count,
            (SELECT COUNT(*) FROM fm_comment_reactions r WHERE r.comment_id = cm.id AND r.value = -1)::int AS dislike_count,
            (SELECT r.value FROM fm_comment_reactions r WHERE r.comment_id = cm.id AND r.user_id = $2::uuid)::smallint AS viewer_reaction,
            cm.created_at
     FROM fm_comments cm
     JOIN fm_users u ON u.id = cm.user_id
     WHERE cm.post_id = $1
     ORDER BY cm.created_at ASC`,
    [postId, viewerId ?? null]
  );
  return rows.map((c) => ({
    ...c,
    viewer_reaction: c.viewer_reaction === 1 || c.viewer_reaction === -1 ? c.viewer_reaction : null,
  }));
}

export async function addComment(
  postId: string,
  userId: string,
  body: string,
  parentId?: string | null,
  photoUrl?: string | null
): Promise<FeedComment> {
  await ensureFeedColumns();
  // A reply must belong to a comment on the same post.
  let parent: string | null = null;
  if (parentId) {
    const check = await queryOne<{ id: string }>(
      `SELECT id::text AS id FROM fm_comments WHERE id = $1::uuid AND post_id = $2`,
      [parentId, postId]
    );
    parent = check?.id ?? null;
  }
  const rows = await query<FeedComment>(
    `INSERT INTO fm_comments (post_id, user_id, body, parent_id, photo_url)
     VALUES ($1, $2, $3, $4::uuid, $5)
     RETURNING id,
       (SELECT name FROM fm_users WHERE id = $2) AS user_name,
       (SELECT avatar_url FROM fm_users WHERE id = $2) AS avatar_url,
       body, photo_url, parent_id::text AS parent_id,
       0 AS like_count, 0 AS dislike_count, NULL::smallint AS viewer_reaction,
       created_at`,
    [postId, userId, body, parent, photoUrl ?? null]
  );
  return { ...rows[0], viewer_reaction: null };
}

/** Toggle the viewer's like/dislike on a comment: 1 = like, -1 = dislike, null = remove. */
export async function toggleCommentReaction(
  commentId: string,
  userId: string,
  value: 1 | -1 | null
): Promise<{ like_count: number; dislike_count: number; viewer_reaction: 1 | -1 | null }> {
  await ensureFeedColumns();
  if (value === null) {
    await query(`DELETE FROM fm_comment_reactions WHERE comment_id = $1 AND user_id = $2`, [
      commentId,
      userId,
    ]);
  } else {
    await query(
      `INSERT INTO fm_comment_reactions (comment_id, user_id, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (comment_id, user_id) DO UPDATE SET value = EXCLUDED.value`,
      [commentId, userId, value]
    );
  }
  const row = await queryOne<{ like_count: number; dislike_count: number; viewer_reaction: number | null }>(
    `SELECT COUNT(*) FILTER (WHERE value = 1)::int AS like_count,
            COUNT(*) FILTER (WHERE value = -1)::int AS dislike_count,
            (SELECT value FROM fm_comment_reactions WHERE comment_id = $1 AND user_id = $2)::int AS viewer_reaction
     FROM fm_comment_reactions
     WHERE comment_id = $1`,
    [commentId, userId]
  );
  const vr = row?.viewer_reaction;
  return {
    like_count: row?.like_count ?? 0,
    dislike_count: row?.dislike_count ?? 0,
    viewer_reaction: vr === 1 || vr === -1 ? vr : null,
  };
}

/** Ensure the follow-system tables/columns exist. */
export async function ensureFollowTables(): Promise<void> {
  await query(
    `ALTER TABLE fm_users ADD COLUMN IF NOT EXISTS allow_follow boolean NOT NULL DEFAULT false`
  );
  await query(`CREATE TABLE IF NOT EXISTS fm_follows (
    follower_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    followee_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, followee_id),
    CONSTRAINT fm_follows_no_self CHECK (follower_id <> followee_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS fm_follows_followee_idx ON fm_follows(followee_id)`);
}

/** Ensure the stories tables exist. Stories expire after 24 hours. */
export async function ensureStoryTables(): Promise<void> {
  await query(`CREATE TABLE IF NOT EXISTS fm_stories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    media_url text NOT NULL,
    media_type text NOT NULL DEFAULT 'photo',
    caption text,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    expires_at timestamptz NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
  )`);
  await query(`CREATE INDEX IF NOT EXISTS fm_stories_user_idx ON fm_stories(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS fm_stories_expires_idx ON fm_stories(expires_at)`);
  await query(`CREATE TABLE IF NOT EXISTS fm_story_views (
    story_id uuid NOT NULL REFERENCES fm_stories(id) ON DELETE CASCADE,
    viewer_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    viewed_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY (story_id, viewer_id)
  )`);
  await query(`ALTER TABLE fm_stories ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false`);
  await query(`ALTER TABLE fm_stories ADD COLUMN IF NOT EXISTS overlays jsonb NOT NULL DEFAULT '[]'::jsonb`);
  await query(`ALTER TABLE fm_stories ADD COLUMN IF NOT EXISTS zoom double precision NOT NULL DEFAULT 1`);
  await query(`ALTER TABLE fm_stories ADD COLUMN IF NOT EXISTS volume double precision`);
  // Story drafts — user's saved photos/videos for stories, kept as square boxes.
  await query(`CREATE TABLE IF NOT EXISTS fm_story_drafts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    media_url text NOT NULL,
    media_type text NOT NULL DEFAULT 'photo',
    duration numeric,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS fm_story_drafts_user_idx ON fm_story_drafts(user_id)`);
  // Add duration column to existing tables.
  await query(`ALTER TABLE fm_story_drafts ADD COLUMN IF NOT EXISTS duration numeric`);
}

export interface StoryOverlay {
  text: string;
  x: number; // 0-100, percent from left
  y: number; // 0-100, percent from top
  font: string;
  color: string;
  bg: string;
  size: number; // px
}

export interface StoryItem {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  media_url: string;
  media_type: string;
  caption: string | null;
  created_at: string;
  viewed: boolean;
  overlays: StoryOverlay[];
  zoom: number;
}

/** Stories from friends + followed users (+ own), newest first, unexpired. */
export async function getStories(viewerId: string | null): Promise<StoryItem[]> {
  await ensureStoryTables();
  await ensureFollowTables();
  const rows = await query<StoryItem & { created_at: string }>(
    `SELECT s.id, s.user_id, u.name AS user_name, u.avatar_url,
            s.media_url, s.media_type, s.caption, s.created_at, s.overlays, s.zoom, s.volume,
            EXISTS(SELECT 1 FROM fm_story_views v
                    WHERE v.story_id = s.id AND v.viewer_id = $1::uuid) AS viewed
       FROM fm_stories s
       JOIN fm_users u ON u.id = s.user_id
      WHERE s.expires_at > NOW()
        AND ($1::uuid IS NULL
             OR s.is_public
             OR s.user_id = $1::uuid
             OR u.name ILIKE 'fishmb'
             OR EXISTS (SELECT 1 FROM fm_friendships f
                        WHERE f.status = 'accepted'
                          AND ((f.requester_id = $1::uuid AND f.addressee_id = s.user_id)
                            OR (f.requester_id = s.user_id AND f.addressee_id = $1::uuid)))
             OR EXISTS (SELECT 1 FROM fm_follows fo
                        WHERE fo.follower_id = $1::uuid AND fo.followee_id = s.user_id))
      ORDER BY s.created_at DESC
      LIMIT 100`,
    [viewerId]
  );
  return rows.map((r) => ({ ...r, viewed: Boolean(r.viewed) }));
}
