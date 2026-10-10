// /api/fish/catches — the social feed.
// GET  → newest-first feed. Public catches always; with auth also friends'
//        catches and your own. ?limit (1-50, default 20) & ?offset.
// POST → log a catch (auth required). Validates species, length, visibility
//        and requires BOTH photo URLs (measure + holding).

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/fish/db";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  publicUser,
  type FishUser,
} from "@/lib/fish/auth";

export interface CatchRow {
  id: string;
  user_id: string;
  species: string;
  length_in: string;
  weight_lb: string | null;
  photo_measure_url: string;
  photo_hold_url: string;
  photos: string[] | null;
  visibility: "public" | "friends" | "private";
  note: string | null;
  feed_caption: string | null;
  caught_at: string;
  created_at: string;
  lat: number | null;
  lng: number | null;
  share_location: boolean | null;
  tournament_id: string | null;
  tournament_name: string | null;
  name: string;
  avatar_url: string | null;
}

function toItem(c: CatchRow, viewerId?: string) {
  // Location is only shared if the catcher allowed it (or it's your own catch).
  const showLocation = c.share_location !== false || (viewerId && c.user_id === viewerId);
  return {
    id: c.id,
    species: c.species,
    length_in: Number(c.length_in),
    weight_lb: c.weight_lb === null ? null : Number(c.weight_lb),
    photo_measure_url: c.photo_measure_url,
    photo_hold_url: c.photo_hold_url,
    photos: Array.isArray(c.photos) ? c.photos : [],
    visibility: c.visibility,
    // Private notes are only visible to the owner; the feed caption is public.
    note: viewerId && c.user_id === viewerId ? c.note : null,
    feed_caption: c.feed_caption ?? null,
    caught_at: c.caught_at,
    created_at: c.created_at,
    lat: showLocation ? c.lat : null,
    lng: showLocation ? c.lng : null,
    tournament_id: c.tournament_id,
    tournament_name: c.tournament_name,
    user: { id: c.user_id, name: c.name, avatar_url: c.avatar_url },
  };
}

const SELECT = `SELECT c.*, u.name, u.avatar_url,
                t.name AS tournament_name
                FROM fm_catches c
                JOIN fm_users u ON u.id = c.user_id
                LEFT JOIN fm_tournaments t ON t.id = c.tournament_id`;

export async function GET(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1), 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  let where: string;
  let params: unknown[];
  if (!me) {
    where = `c.visibility = 'public' AND c.personal_record = false`;
    params = [];
  } else {
    // Public catches, friends' catches (both directions), and your own.
    // Personal records are excluded from the feed (they live in your catch history).
    where = `(
      c.personal_record = false AND (
        c.visibility = 'public'
        OR c.user_id = $1
        OR (c.visibility = 'friends' AND EXISTS (
              SELECT 1 FROM fm_friendships f
               WHERE f.status = 'accepted'
                 AND ((f.requester_id = $1 AND f.addressee_id = c.user_id)
                   OR (f.addressee_id = $1 AND f.requester_id = c.user_id))
            ))
      )
    )`;
    params = [me.id];
  }

  const rows = await query<CatchRow>(
    `${SELECT} WHERE ${where} ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const total = await queryOne<{ n: string }>(
    `SELECT COUNT(*) AS n FROM fm_catches c WHERE ${where}`,
    params
  );
  return NextResponse.json({
    catches: rows.map((c) => toItem(c, me?.id)),
    total: Number(total?.n ?? 0),
    limit,
    offset,
  });
}

const VISIBILITIES = ["public", "friends", "private"] as const;

export async function POST(req: NextRequest) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const species = typeof body.species === "string" ? body.species.trim().slice(0, 80) : "";
  if (!species) return badRequest("species is required.");
  const lengthIn = Number(body.length_in);
  if (!Number.isFinite(lengthIn) || lengthIn <= 0 || lengthIn > 999) {
    return badRequest("length_in must be a positive number of inches.");
  }
  const weightLb =
    body.weight_lb === undefined || body.weight_lb === null ? null : Number(body.weight_lb);
  if (weightLb !== null && (!Number.isFinite(weightLb) || weightLb <= 0 || weightLb > 999)) {
    return badRequest("weight_lb must be a positive number of pounds.");
  }
  const visibility = body.visibility ?? "public";
  if (!VISIBILITIES.includes(visibility as (typeof VISIBILITIES)[number])) {
    return badRequest("visibility must be public, friends or private.");
  }
  const photoMeasure = typeof body.photo_measure_url === "string" ? body.photo_measure_url : "";
  const photoHold = typeof body.photo_hold_url === "string" ? body.photo_hold_url : "";
  for (const [label, v] of [["photo_measure_url", photoMeasure], ["photo_hold_url", photoHold]] as const) {
    if (!v || !/^https?:\/\//.test(v) || v.length > 2048) {
      return badRequest(`${label} is required and must be an http(s) URL.`);
    }
  }
  // Optional multi-photo array (up to 4). First photo stays primary via photo_measure_url/photo_hold_url.
  let photos: string[] = [];
  if (Array.isArray(body.photos)) {
    photos = body.photos
      .filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u) && u.length <= 2048)
      .slice(0, 4);
  }
  if (photos.length === 0) photos = [photoMeasure];
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  // Public caption shown with the catch on the feed (separate from private notes).
  const feedCaption =
    typeof body.feed_caption === "string" ? body.feed_caption.trim().slice(0, 500) || null : null;
  let caughtAt: string | null = null;
  if (body.caught_at !== undefined && body.caught_at !== null) {
    const d = new Date(String(body.caught_at));
    if (Number.isNaN(d.getTime())) return badRequest("caught_at must be an ISO date.");
    caughtAt = d.toISOString();
  }

  // Optional GPS coords saved from the catch composer.
  // (The feed composer sends latitude/longitude; the app sends lat/lng.)
  const rawLat =
    body.lat === undefined || body.lat === null
      ? body.latitude === undefined || body.latitude === null
        ? null
        : Number(body.latitude)
      : Number(body.lat);
  const rawLng =
    body.lng === undefined || body.lng === null
      ? body.longitude === undefined || body.longitude === null
        ? null
        : Number(body.longitude)
      : Number(body.lng);
  const lat =
    rawLat === null ? null : Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : null;
  const lng =
    rawLng === null
      ? null
      : Number.isFinite(rawLng) && rawLng >= -180 && rawLng <= 180
        ? rawLng
        : null;
  if ((body.lat !== undefined && body.lat !== null && lat === null) || (body.lng !== undefined && body.lng !== null && lng === null)) {
    return badRequest("lat must be between -90 and 90, lng between -180 and 180.");
  }

  // Whether the catch location may appear on other anglers' maps.
  const shareLocation = body.share_location === undefined ? true : body.share_location === true;

  // Personal record: saved to catch history/stats but excluded from the feed.
  const personalRecord = body.personal_record === true;

  // Optional tournament link (for feed display of tournament stats).
  const tournamentId = typeof body.tournament_id === "string" && body.tournament_id ? body.tournament_id : null;

  // Optional weather snapshot captured at log time (temp °C, condition code, wind kph).
  let weather: { temp_c: number; code: number; wind_kph: number } | null = null;
  if (body.weather && typeof body.weather === "object") {
    const w = body.weather as Record<string, unknown>;
    const t = Number(w.temp_c);
    const c = Number(w.code);
    const wk = Number(w.wind_kph);
    if (Number.isFinite(t) && Number.isFinite(c)) {
      weather = { temp_c: t, code: c, wind_kph: Number.isFinite(wk) ? wk : 0 };
    }
  }

  // Multi-photo storage (idempotent — same column the feed query already reads).
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS photos jsonb`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS lat double precision`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS lng double precision`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS share_location boolean DEFAULT true`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS weather jsonb`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES fm_tournaments(id) ON DELETE SET NULL`);
  await query(`ALTER TABLE fm_catches ADD COLUMN IF NOT EXISTS feed_caption text`);
  const rows = await query<CatchRow>(
    `INSERT INTO fm_catches
       (user_id, species, length_in, weight_lb, photo_measure_url, photo_hold_url, photos, visibility, note, feed_caption, caught_at, lat, lng, share_location, weather, personal_record, tournament_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,COALESCE($11::timestamptz, now()),$12,$13,$14,$15::jsonb,$16,$17::uuid)
     RETURNING *, (SELECT name FROM fm_users WHERE id = $1) AS name,
                   (SELECT avatar_url FROM fm_users WHERE id = $1) AS avatar_url`,
    [me.id, species, lengthIn, weightLb, photoMeasure, photoHold, JSON.stringify(photos), visibility, note, feedCaption, caughtAt, lat, lng, shareLocation, weather ? JSON.stringify(weather) : null, personalRecord, tournamentId]
  );
  const newCatch = rows[0];

  // A catch with GPS coords becomes a personal fishing spot.
  if (lat !== null && lng !== null) {
    try {
      const { ensureSpotsTable, createSpot } = await import("@/lib/fish/spots");
      await ensureSpotsTable();
      await createSpot(me.id, {
        name: `${species} spot`,
        lat,
        lng,
        catchId: newCatch.id,
      });
    } catch {
      // Spot creation is best-effort — the catch itself is already saved.
    }
  }
  return NextResponse.json({ catch: toItem(newCatch) }, { status: 201 });
}
