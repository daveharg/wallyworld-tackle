-- Water depth (feet) on catches and fishing spots. Added Oct 2026.
-- The API also self-applies these (ADD COLUMN IF NOT EXISTS) at request
-- time, following the existing pattern in the catches/spots routes.
ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS depth_ft numeric(6,1);
ALTER TABLE fm_fishing_spots ADD COLUMN IF NOT EXISTS depth_ft numeric(6,1);
