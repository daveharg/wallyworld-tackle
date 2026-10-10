-- Link regular catches to tournaments (for feed display of tournament stats).
ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES fm_tournaments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fm_catches_tournament_idx ON fm_catches(tournament_id) WHERE tournament_id IS NOT NULL;
