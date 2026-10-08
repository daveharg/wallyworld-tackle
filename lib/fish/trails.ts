// FishMB recorded boat trails — private GPS tracks per user. Recorded from
// the My Maps page ("record route"), overlaid on the map to retrace a route.

import { query, queryOne } from "./db";
import { isValidLat, isValidLng } from "./spots";

export interface TrailPoint {
  lat: number;
  lng: number;
  t: number; // epoch ms
}

export interface BoatTrail {
  id: string;
  user_id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  points: TrailPoint[];
  distance_m: number;
  created_at: string;
}

const MAX_POINTS = 5000;

let ensured = false;

export async function ensureTrailsTable(): Promise<void> {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS fm_trails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES fm_users(id) ON DELETE CASCADE,
    name text NOT NULL DEFAULT '',
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz NULL,
    points jsonb NOT NULL DEFAULT '[]'::jsonb,
    distance_m double precision NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query(`CREATE INDEX IF NOT EXISTS fm_trails_user_id_idx ON fm_trails(user_id)`);
  ensured = true;
}

function cleanPoints(raw: unknown): TrailPoint[] | null {
  if (!Array.isArray(raw)) return null;
  const out: TrailPoint[] = [];
  for (const p of raw.slice(0, MAX_POINTS)) {
    const q = p as Record<string, unknown>;
    const lat = typeof q.lat === "number" ? q.lat : Number(q.lat);
    const lng = typeof q.lng === "number" ? q.lng : Number(q.lng);
    const t = typeof q.t === "number" ? q.t : Number(q.t);
    if (!isValidLat(lat) || !isValidLng(lng) || !Number.isFinite(t)) return null;
    out.push({ lat, lng, t });
  }
  return out;
}

export async function listTrails(userId: string): Promise<BoatTrail[]> {
  await ensureTrailsTable();
  return query<BoatTrail>(
    `SELECT id, user_id, name, started_at, ended_at, points, distance_m, created_at
       FROM fm_trails
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );
}

export async function createTrail(
  userId: string,
  trail: { name: string; points: unknown; distance_m: unknown }
): Promise<BoatTrail> {
  await ensureTrailsTable();
  const points = cleanPoints(trail.points);
  if (!points || points.length < 2) throw new Error("A trail needs at least 2 GPS points.");
  const distance =
    typeof trail.distance_m === "number" && Number.isFinite(trail.distance_m) && trail.distance_m >= 0
      ? Math.min(trail.distance_m, 10000000)
      : 0;
  const row = await queryOne<BoatTrail>(
    `INSERT INTO fm_trails (user_id, name, ended_at, points, distance_m)
     VALUES ($1, $2, now(), $3::jsonb, $4)
     RETURNING id, user_id, name, started_at, ended_at, points, distance_m, created_at`,
    [
      userId,
      typeof trail.name === "string" && trail.name.trim()
        ? trail.name.trim().slice(0, 80)
        : "Boat trail",
      JSON.stringify(points),
      distance,
    ]
  );
  if (!row) throw new Error("Could not save trail.");
  return row;
}

export async function deleteTrail(userId: string, trailId: string): Promise<boolean> {
  await ensureTrailsTable();
  const rows = await query<{ id: string }>(
    `DELETE FROM fm_trails WHERE id = $1 AND user_id = $2 RETURNING id`,
    [trailId, userId]
  );
  return rows.length > 0;
}
