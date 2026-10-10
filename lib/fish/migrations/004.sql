-- Follow system: users can allow others to follow them.
ALTER TABLE fm_users ADD COLUMN IF NOT EXISTS allow_follow boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS fm_follows (
  follower_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT fm_follows_no_self CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS fm_follows_followee_idx ON fm_follows(followee_id);
