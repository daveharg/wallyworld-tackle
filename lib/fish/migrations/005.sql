-- Personal record catches: saved to catch history/stats but excluded from the feed.
ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS personal_record boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS fm_catches_personal_record_idx ON fm_catches(user_id) WHERE personal_record = false;
