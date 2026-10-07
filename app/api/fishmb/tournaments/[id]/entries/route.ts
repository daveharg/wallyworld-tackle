// /api/fishmb/tournaments/[id]/entries — catch entries.
//
// GET  — entries. Organizer sees all; everyone else sees approved only.
// POST — submit an entry (auth + must have joined). Anti-cheat enforced:
//   * tournament must be live on the SERVER clock (no backdating)
//   * photo is required; its bytes are SHA-256 hashed for duplicate detection
//   * GPS coordinates, when provided, must fall inside Manitoba

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
  return NextResponse.json({ entries, is_organizer: organizer });
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

  // Server clock is the official tournament clock — no backdating.
  const now = Date.now();
  if (now < new Date(t.starts_at).getTime()) return badRequest("This tournament hasn't started yet.");
  if (now > new Date(t.ends_at).getTime()) return badRequest("This tournament has ended.");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

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
       (tournament_id, user_id, photo_url, species, length_inches, latitude, longitude, gps_accuracy, notes, photo_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [t.id, me.id, photoUrl, species, lengthIn, lat, lng, acc, notes, photoHash]
  );
  return NextResponse.json({ entry }, { status: 201 });
}
