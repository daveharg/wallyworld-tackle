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
  isParticipant,
  gpsInManitoba,
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
  const entries = await getEntries(t.id, organizer ? ["pending", "approved", "rejected"] : ["approved"]);
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

  const photoUrl = typeof body.photo_url === "string" ? body.photo_url.trim() : "";
  if (!photoUrl || !/^https?:\/\//.test(photoUrl)) return badRequest("A photo is required for every catch.");
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
  let photoHash: string | null = null;
  try {
    const res = await fetch(photoUrl, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 0 && buf.length < 20 * 1024 * 1024) {
        photoHash = createHash("sha256").update(buf).digest("hex");
      }
    }
  } catch {
    photoHash = null;
  }

  const entry = await queryOne(
    `INSERT INTO fm_tournament_entries
       (tournament_id, user_id, photo_url, species, length_inches, latitude, longitude, gps_accuracy, notes, photo_hash, captured_at, time_flag)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [t.id, me.id, photoUrl, species, lengthIn, lat, lng, acc, notes, photoHash, capturedAt.toISOString(), timeFlag]
  );
  return NextResponse.json({ entry }, { status: 201 });
}
