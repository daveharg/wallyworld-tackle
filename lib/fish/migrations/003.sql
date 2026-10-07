-- Fish Manitoba feed — migration 003
-- Evolves fm_discussions into the full Feed: post kinds ('post'|'ad'),
-- optional photo attachments, and comments.
-- Safe to re-run (IF NOT EXISTS / guarded ALTERs).
-- Run ONCE against the Neon database with the DIRECT (non-pooled) connection string:
--   psql "$DATABASE_URL_DIRECT" -f lib/fish/migrations/003.sql
-- Do NOT run against production without approval.

-- ---------------------------------------------------------------------------
-- Feed posts: kind + optional photo
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fm_discussions' AND column_name = 'kind'
  ) THEN
    ALTER TABLE fm_discussions ADD COLUMN kind text NOT NULL DEFAULT 'post';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fm_discussions' AND column_name = 'photo_url'
  ) THEN
    ALTER TABLE fm_discussions ADD COLUMN photo_url text;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Comments on feed posts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fm_comments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid        NOT NULL REFERENCES fm_discussions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fm_comments_post_idx   ON fm_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS fm_comments_user_idx   ON fm_comments(user_id);
