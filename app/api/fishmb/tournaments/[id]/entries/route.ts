// /api/fishmb/tournaments/[id]/entries — catch entries.
//
// GET  — entries. Organizer sees all; everyone else sees approved only.
// POST — submit an entry (auth + must have joined). Anti-cheat enforced:
//   * photo is required; its bytes are SHA-256 hashed for duplicate detection
//   * GPS coordinates, when provided, must fall inside Manitoba
//   * the tournament window is enforced on the CAPTURE time:
//     - online submissions: capture time = server receipt time
//     - offline app submissions: the phone's capture timestamp is accepted,
//       but a capture time in the future (beyond clock-skew tolerance) is
//       flagged for the organizer, and created_at always records when our
//       server actually received the entry

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  fishUserFromRequest,
  unauthorized,
  badRequest,
  notFound,
} from "@/lib/fish/auth";
import {
  getTournament,
  getEntries,
  getEntriesForViewer,
  isParticipant,
  gpsInManitoba,
  nearestTournamentLake,
  LAKE_BOUNDARY_KM,
  computePHash,
  phashDistance,
  PHASH_SIMILARITY_THRESHOLD,
} from "@/lib/fish/tournaments";
import { query, queryOne } from "@/lib/fish/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = await getTournament(params.id);
  if (!t) return notFound("Tournament not found.");
  const me = await fishUserFromRequest(req);
  const organizer = !!me && me.id === t.organizer_id;
  // Organizers see everything; anglers see approved entries plus their own
  // pending ones (so a submission never feels like it vanished).
  const entries = organizer
    ? await getEntries(t.id, ["pending", "approved", "rejected"])
    : await getEntriesForViewer(t.id, me ? me.id : null, !!t.hide_locations);
  return NextResponse.json({ tournament: t, entries, is_organizer: organizer });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const me = await fishUserFromRequest(req);
  if (!me) return unauthorized();
  const t = await getTournament(params.id);
  if (!t) return notFound("Tournament not found.");
  if (!(await isParticipant(t.id, me.id))) {
    return NextResponse.json({ error: "Join the tournament before submitting a catch." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  // Capture time: online submissions use the server clock; the offline app
  // sends the phone's capture timestamp (Dave's call — entries are stamped
  // when the picture was taken, wherever the angler is).
  const now = Date.now();
  let capturedAt: Date;
  let timeFlag: string | null = null;
  if (typeof body.captured_at === "string" && body.captured_at) {
    const parsed = new Date(body.captured_at);
    if (isNaN(parsed.getTime())) return badRequest("Invalid capture time.");
    if (parsed.getTime() > now + 5 * 60 * 1000) {
      // Claimed capture is in the future beyond clock-skew tolerance —
      // impossible; flag for the organizer instead of silently accepting.
      timeFlag = "future_timestamp";
    }
    capturedAt = parsed;
  } else {
    capturedAt = new Date(now);
  }

  // The tournament window is enforced on the capture time, not the sync time —
  // a catch made inside the window still counts even if it uploads late.
  if (capturedAt.getTime() < new Date(t.starts_at).getTime())
    return badRequest("This catch was made before the tournament started.");
  if (capturedAt.getTime() > new Date(t.ends_at).getTime())
    return badRequest("This catch was made after the tournament ended.");

  // Photos: 1–4 per catch. The web sends photo_urls (array); the Expo app
  // sends a lone photo_url string (back-compat). photo_url = photo_urls[0].
  let photoUrls: string[] = [];
  if (Array.isArray(body.photo_urls)) {
    photoUrls = body.photo_urls
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//.test(u))
      .slice(0, 4);
  }
  const photoUrl =
    photoUrls[0] ??
    (typeof body.photo_url === "string" && /^https?:\/\//.test(body.photo_url.trim())
      ? body.photo_url.trim()
      : "");
  if (!photoUrl) return badRequest("A photo is required for every catch.");
  if (photoUrls.length === 0) photoUrls = [photoUrl];
  const species = typeof body.species === "string" ? body.species.trim().slice(0, 60) : "";
  if (!species) return badRequest("Species is required.");
  const lengthIn =
    typeof body.length_inches === "number" && body.length_inches > 0 && body.length_inches < 100
      ? body.length_inches
      : null;
  const lat = typeof body.latitude === "number" ? body.latitude : null;
  const lng = typeof body.longitude === "number" ? body.longitude : null;
  const acc = typeof body.gps_accuracy === "number" ? body.gps_accuracy : null;
  if (lat !== null && lng !== null && !gpsInManitoba(lat, lng)) {
    return badRequest("That location isn't in Manitoba — entries must be caught in Manitoba waters.");
  }
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";

  // Hash the photo bytes for duplicate detection (same fish submitted twice).
  // SHA-256 catches exact re-submits; the perceptual hash catches the same
  // fish photographed again from a slightly different angle.
  let photoHash: string | null = null;
  let photoPHash: string | null = null;
  try {
    const res = await fetch(photoUrl, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 0 && buf.length < 20 * 1024 * 1024) {
        photoHash = createHash("sha256").update(buf).digest("hex");
        photoPHash = await computePHash(buf);
      }
    }
  } catch {
    photoHash = null;
  }

  // Same-fish flags for the organizer:
  //  - similar_photo_of: another entry whose photo looks like this one
  //  - similar_catch_of: same angler, same species, near-identical length,
  //    caught within 30 minutes — possibly two photos of one fish.
  let similarPhotoOf: string | null = null;
  let similarCatchOf: string | null = null;
  try {
    if (photoPHash) {
      const candidates = await query<{ id: string; photo_phash: string }>(
        `SELECT id, photo_phash FROM fm_tournament_entries
         WHERE tournament_id = $1 AND photo_phash IS NOT NULL AND id != $2`,
        [t.id, "00000000-0000-0000-0000-000000000000"]
      );
      let best: string | null = null;
      let bestDist = PHASH_SIMILARITY_THRESHOLD + 1;
      for (const c of candidates) {
        const d = phashDistance(photoPHash, c.photo_phash);
        if (d < bestDist) {
          bestDist = d;
          best = c.id;
        }
      }
      // An exact byte-match is already covered by duplicate_of; the
      // perceptual flag targets near-duplicates (same fish, new photo).
      if (best) {
        const exactDup = photoHash
          ? await queryOne<{ id: string }>(
              `SELECT id FROM fm_tournament_entries
               WHERE tournament_id = $1 AND photo_hash = $2
               ORDER BY created_at ASC LIMIT 1`,
              [t.id, photoHash]
            )
          : null;
        if (!exactDup || exactDup.id !== best) similarPhotoOf = best;
      }
    }
    const like = await queryOne<{ id: string }>(
      `SELECT id FROM fm_tournament_entries
       WHERE tournament_id = $1 AND user_id = $2
         AND LOWER(species) = LOWER($3)
         AND length_inches IS NOT NULL AND $4 IS NOT NULL
         AND ABS(length_inches - $4) <= 0.5
         AND ABS(EXTRACT(EPOCH FROM (captured_at - $5::timestamptz))) <= 1800
       ORDER BY captured_at DESC LIMIT 1`,
      [t.id, me.id, species, lengthIn, capturedAt.toISOString()]
    );
    if (like) similarCatchOf = like.id;
  } catch {
    // Flags are best-effort; never block a submission.
  }

  // Lake-boundary check: tournaments run on specific water. Measure the entry
  // GPS against the tournament's chosen lake(s); flag (never auto-reject) when
  // it's outside lake waters so the organizer can review it.
  let lakeDistanceKm: number | null = null;
  let locationFlag: string | null = null;
  const lakeIds = Array.isArray(t.lake_ids) ? t.lake_ids : [];
  if (lakeIds.length > 0) {
    if (lat !== null && lng !== null) {
      const near = nearestTournamentLake(lat, lng, lakeIds);
      if (near) {
        lakeDistanceKm = Math.round(near.km * 10) / 10;
        if (near.km > LAKE_BOUNDARY_KM) locationFlag = "outside-lake";
      } else {
        locationFlag = "no-gps";
      }
    } else {
      locationFlag = "no-gps";
    }
  }

  const entry = await queryOne(
    `INSERT INTO fm_tournament_entries
       (tournament_id, user_id, photo_url, photo_urls, species, length_inches, latitude, longitude, gps_accuracy, notes, photo_hash, photo_phash, similar_photo_of, similar_catch_of, captured_at, time_flag, lake_distance_km, location_flag, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [t.id, me.id, photoUrl, JSON.stringify(photoUrls), species, lengthIn, lat, lng, acc, notes, photoHash, photoPHash, similarPhotoOf, similarCatchOf, capturedAt.toISOString(), timeFlag, lakeDistanceKm, locationFlag, t.auto_approve_entries ? "approved" : "pending"]
  );
  return NextResponse.json({ entry }, { status: 201 });
}
