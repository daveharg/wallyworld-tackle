-- Add video support to catches
ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS video_playback_id text;
ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS video_url text;
