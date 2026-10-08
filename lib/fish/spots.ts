// FishMB personal GPS fishing spots — strictly per-user. Spots can be saved
// from a catch (which carries its own coords) or added manually in the profile.

import { query, queryOne } from "./db";

export interface FishingSpot {
  id: string;
  user_id: string;
  name: string;
  lat: number;
  lng: number;
  notes: string | null;
  catch_id: string | null;
  created_at: string;
}

let ensured = false;

export async function ensureSpotsTable(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_fishing_spots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    name text NOT NULL DEFAULT '',
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    notes text DEFAULT '',
    catch_id uuid NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(
    `CREATE INDEX IF NOT EXISTS fm_fishing_spots_user_id_idx ON fm_fishing_spots(user_id)`
  );
  // Catches can carry their own GPS coords (saved from the catch composer).
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS lat double precision`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS lng double precision`);
  ensured = true;
}

export function isValidLat(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= -90 && v <= 90;
}

export function isValidLng(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= -180 && v <= 180;
}

export async function listSpots(userId: string): Promise<FishingSpot[]> {
  const rows = await query<FishingSpot>(
    `SELECT id, user_id, name, lat, lng, notes, catch_id, created_at
       FROM fm_fishing_spots
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function createSpot(
  userId: string,
  spot: { name: string; lat: number; lng: number; notes?: string | null; catchId?: string | null }
): Promise<FishingSpot> {
  const row = await queryOne<FishingSpot>(
    `INSERT INTO fm_fishing_spots (user_id, name, lat, lng, notes, catch_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, name, lat, lng, notes, catch_id, created_at`,
    [
      userId,
      spot.name.trim().slice(0, 80) || "Fishing spot",
      spot.lat,
      spot.lng,
      spot.notes?.trim().slice(0, 500) || null,
      spot.catchId ?? null,
    ]
  );
  if (!row) throw new Error("Could not create spot.");
  return row;
}

export async function updateSpot(
  userId: string,
  spotId: string,
  patch: { name?: string; notes?: string | null }
): Promise<FishingSpot | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.name !== undefined) {
    vals.push(patch.name.trim().slice(0, 80) || "Fishing spot");
    sets.push(`name = $${vals.length}`);
  }
  if (patch.notes !== undefined) {
    vals.push(patch.notes === null ? null : patch.notes.trim().slice(0, 500) || null);
    sets.push(`notes = $${vals.length}`);
  }
  if (sets.length === 0) {
    return queryOne<FishingSpot>(
      `SELECT id, user_id, name, lat, lng, notes, catch_id, created_at
         FROM fm_fishing_spots WHERE id = $${vals.length + 1} AND user_id = $${vals.length + 2}`,
      [spotId, userId]
    );
  }
  vals.push(spotId, userId);
  return queryOne<FishingSpot>(
    `UPDATE fm_fishing_spots SET ${sets.join(", ")}
      WHERE id = $${vals.length - 1} AND user_id = $${vals.length}
     RETURNING id, user_id, name, lat, lng, notes, catch_id, created_at`,
    vals
  );
}

export async function deleteSpot(userId: string, spotId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `DELETE FROM fm_fishing_spots WHERE id = $1 AND user_id = $2 RETURNING id`,
    [spotId, userId]
  );
  return rows.length > 0;
}
