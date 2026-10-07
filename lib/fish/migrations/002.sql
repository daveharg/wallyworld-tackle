-- Fish Manitoba discussions — migration 002
-- Adds the fm_discussions table (short text posts for the Discussions feed tab).
-- Safe to re-run (IF NOT EXISTS).
-- Run ONCE against the Neon database with the DIRECT (non-pooled) connection string:
--   psql "$DATABASE_URL_DIRECT" -f lib/fish/migrations/002.sql
-- Do NOT run against production without approval.

-- ---------------------------------------------------------------------------
-- Discussions (text posts; newest-first feed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fm_discussions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  body        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fm_discussions_user_idx    ON fm_discussions(user_id);
CREATE INDEX IF NOT EXISTS fm_discussions_created_idx ON fm_discussions(created_at DESC);
